#!/usr/bin/env python3
"""Stop hook: 定期讓當班女僕「照鏡子」，把場景描寫寫進這個 session 的 look.txt

- 節流：context 每長 CTX_STEP 個 token 才重照一次
- 防遞迴：子 session 帶 CLAUDE_MAID_SUB=1，看到就直接退出
- 非阻塞：fork 出去背景跑，Stop hook 立刻返回
- 子 session 看不到本場對話，所以把心情／工作內容／context 用量當作狀態餵進去

look.txt 格式：第 1 行場景描寫、第 2 行角色台詞。
"""
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
import maidstate
from maidstate import HOME, on_shift, persona_file, state_dir

CTX_STEP = 50_000  # context 每長這麼多 token 就重新照一次鏡子
LOCK_STALE = 300


def read(path):
    return maidstate.read(path).strip()


def fresh(path, ttl):
    try:
        return time.time() - os.path.getmtime(path) < ttl
    except OSError:
        return False


def persona(maid_id):
    path = persona_file(maid_id)
    body = read(path) if path else ""
    # 剝掉 frontmatter，只留人設本文
    return re.sub(r"\A---\n.*?\n---\n", "", body, flags=re.S).strip()


def transcript_stats(path):
    """從 transcript 抽出：輪數、大小、最近的任務、用過的工具、當下 context token 數。"""
    turns, tasks, tools, ctx = 0, [], {}, 0
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        size = os.path.getsize(path)
    except OSError:
        return 0, 0, [], {}, 0

    for line in lines[-300:]:
        try:
            entry = json.loads(line)
        except Exception:
            continue
        kind = entry.get("type")
        content = entry.get("message", {}).get("content")

        if kind == "user":
            if isinstance(content, str):
                text = content
            else:
                # tool_result 不是使用者說的話，跳過
                text = " ".join(c.get("text", "") for c in (content or [])
                                if isinstance(c, dict) and c.get("type") == "text")
            text = re.sub(r"<[^>]+>.*?</[^>]+>", "", text, flags=re.S).strip()
            if text and not text.startswith("<"):
                turns += 1  # tool_result 也是 user entry，只算真正的發言
                tasks.append(text[:80])
        elif kind == "assistant":
            usage = entry.get("message", {}).get("usage") or {}
            if usage:
                ctx = (usage.get("input_tokens", 0)
                       + usage.get("cache_creation_input_tokens", 0)
                       + usage.get("cache_read_input_tokens", 0))
            if isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "tool_use":
                        name = c.get("name", "")
                        tools[name] = tools.get(name, 0) + 1

    return turns, size, tasks[-3:], tools, ctx


# context 越長，代表這班已經連著幹了多久活。四個階段，一階比一階狼狽。
# 第一個欄位是該階段的「上限」：ctx 小於它就用這段，None 代表沒有上限。
#   ~80k / 80k~160k / 160k~240k / 240k~320k / 320k~
# 只給「程度」，不給具體畫面——寫太細模型就只會照抄重排，失去每次的變化。
STAGES = [
    (80_000, "剛上工不久", "衣裝整齊、精神飽滿"),
    (160_000, "忙了一陣子", "微微凌亂、開始出汗"),
    (240_000, "已經連軸轉很久", "明顯凌亂、臉紅、呼吸不穩"),
    (320_000, "快撐不住了", "相當狼狽、汗濕、講話會斷句"),
    (None, "撐到極限了", "極度狼狽、大口喘氣、快站不住了"),
]


def stage_of(ctx):
    for limit, label, look in STAGES:
        if limit is None or ctx < limit:
            return label, look
    return STAGES[-1][1], STAGES[-1][2]


def build_prompt(maid_id, turns, tasks, tools, cwd, ctx, sdir):
    mood = read(f"{sdir}/mood.txt") or "普通"
    stage_label, stage_look = stage_of(ctx)
    top = sorted(tools.items(), key=lambda kv: -kv[1])[:5]
    tool_line = "、".join(f"{n}×{c}" for n, c in top) or "還沒動手"
    task_line = "\n".join(f"  · {t}" for t in tasks) or "  · （還沒交代）"
    return f"""{persona(maid_id)}

---

以上是你的角色設定。現在有人想「看」你一眼。

你此刻的狀態：
- 心情：{mood}
- 已經連續工作了 {turns} 輪對話
- 工作場所：{cwd}
- 主人最近交代的事：
{task_line}
- 手邊動用的工具：{tool_line}

**體力狀態：{stage_label}（{stage_look}）**

請用你的角色語氣，以第三人稱描寫你**此刻**的樣子——外貌、表情、精神狀態。

括號裡那幾個字只是**程度指引**，不是要你照抄的句子——具體是哪個部位、什麼動作、
什麼畫面，全部由你自己想，每次挑不同的角度切入（可以寫手、寫背影、寫倒影、
寫正在做的家務、寫周圍的器物）。但**程度必須寫到位**：指引說「極度狼狽」
就不能只寫一滴汗，要讓人一眼看出快撐不住了。
這是**長時間勞動後的狼狽**，寫的是一個女僕幹活幹到滿頭大汗的樣子，
不要往別的意味上帶。

描寫也要**隱約透出手邊正在忙的事**。
**狼狽的程度所有人一樣，但被看到這副樣子時的反應由你的角色設定決定**——
嘴硬、撒嬌、逞強、吐槽還是害羞，照你自己的個性演。
**禁止**直接說出「疲勞」「累」「體力」這類字眼，全部靠外觀動作透露。

**一律使用繁體中文（台灣用語）**，不可出現任何簡體字。

嚴格照這個格式輸出，只有兩行、不要任何前後說明、不要引號：
第 1 行：場景描寫，40 個中文字以內，一句話。
第 2 行：一句角色台詞，25 個中文字以內（語氣也要符合體力狀態，越後面越有氣無力）。
"""


def main():
    if os.environ.get("CLAUDE_MAID_SUB"):
        return
    maid_id = on_shift()
    if not maid_id:
        return

    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    # 每個 session 一份狀態，同時開好幾個視窗才不會互相蓋掉
    sdir = state_dir(payload.get("session_id"))
    look_file = f"{sdir}/look.txt"
    lock_file = f"{sdir}/look.lock"
    state_file = f"{sdir}/look.ctx"
    if fresh(lock_file, LOCK_STALE):
        return

    turns, size, tasks, tools, ctx = transcript_stats(payload.get("transcript_path", ""))
    cwd = os.path.basename(payload.get("cwd", "") or os.getcwd()) or "不明的角落"

    # 節流看的是 context 成長量，不是時間。
    # ctx 變小代表剛 /compact 過，那就重照一次。
    try:
        last = int(read(state_file))
    except ValueError:
        last = None
    if last is not None and 0 <= ctx - last < CTX_STEP and os.path.exists(look_file):
        return

    # 交給背景 process，Stop hook 不等它
    if os.fork() != 0:
        return
    os.setsid()

    open(lock_file, "w").close()
    try:
        env = dict(os.environ, CLAUDE_MAID_SUB="1")
        # prompt 走 stdin，免得內文開頭的字元被當成 CLI option
        out = subprocess.run(
            ["claude", "-p", "--model", "haiku"],
            input=build_prompt(maid_id, turns, tasks, tools, cwd, ctx, sdir),
            capture_output=True, text=True, timeout=90, env=env,
        ).stdout.strip()
        lines = [re.sub(r'^["「『]|["」』]$', "", l.strip())
                 for l in out.splitlines() if l.strip()]
        if lines:
            with open(look_file, "w", encoding="utf-8") as f:
                f.write("\n".join(lines[:2]) + "\n")
            # 生成成功才記帳，失敗的話下一輪會再試
            with open(state_file, "w") as f:
                f.write(str(ctx))
    except Exception:
        pass
    finally:
        try:
            os.unlink(lock_file)
        except OSError:
            pass
    os._exit(0)


if __name__ == "__main__":
    main()
