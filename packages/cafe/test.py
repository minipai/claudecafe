#!/usr/bin/env python3
"""Logic tests for the cafe plugin — run before installing or bumping:

    python3 packages/cafe/test.py

Sandbox HOME, no network, no claude CLI.
Covers the pure logic where the silent-failure bugs live (shift resolution,
cast pool, persona files, festival packs, status rows, transcript stats) —
not the prompt prose or anything an LLM generates.
"""
import atexit
import importlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

TEST_HOME = tempfile.mkdtemp(prefix="cafe-test-")
atexit.register(shutil.rmtree, TEST_HOME, ignore_errors=True)
os.environ["HOME"] = TEST_HOME  # must precede the imports below
for var in ("CLAUDE_MAID", "CLAUDE_MAID_LANG", "CLAUDE_MAID_SUB"):
    os.environ.pop(var, None)

PLUGIN = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, f"{PLUGIN}/bin")
sys.path.insert(0, f"{PLUGIN}/hooks")
import maidstate  # noqa: E402
festival = importlib.import_module("festival")
load_persona = importlib.import_module("load-persona")
look_update = importlib.import_module("look-update")

CAFE = f"{TEST_HOME}/.claude/cafe"
FAKE_PLUGIN = f"{TEST_HOME}/fake-plugin"


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def set_config(data):
    write(maidstate.CONFIG, json.dumps(data))


class CafeTest(unittest.TestCase):
    """Fresh sandbox state + a fake bundled maids/ with the fallback maid."""

    def setUp(self):
        shutil.rmtree(CAFE, ignore_errors=True)
        shutil.rmtree(FAKE_PLUGIN, ignore_errors=True)
        write(f"{FAKE_PLUGIN}/maids/noname.md",
              "---\nname: ？？？\n---\nThe maid with no name.\n")
        for mod in (maidstate, load_persona):
            self._real_root = mod.PLUGIN_ROOT
            mod.PLUGIN_ROOT = FAKE_PLUGIN

    def tearDown(self):
        for mod in (maidstate, load_persona):
            mod.PLUGIN_ROOT = self._real_root


class ConfigTest(CafeTest):
    def test_missing_broken_and_non_object_all_give_empty(self):
        self.assertEqual(maidstate.config(), {})
        write(maidstate.CONFIG, "{not json")
        self.assertEqual(maidstate.config(), {})
        write(maidstate.CONFIG, '"English"')  # valid JSON, wrong shape
        self.assertEqual(maidstate.config(), {})

    def test_valid_config_reads_back(self):
        set_config({"maid": "kurumi"})
        self.assertEqual(maidstate.config()["maid"], "kurumi")

    def test_lang_priority_env_config_default(self):
        self.assertEqual(maidstate.lang(), maidstate.DEFAULT_LANG)
        set_config({"lang": "日本語"})
        self.assertEqual(maidstate.lang(), "日本語")
        os.environ["CLAUDE_MAID_LANG"] = "Deutsch"
        try:
            self.assertEqual(maidstate.lang(), "Deutsch")
        finally:
            del os.environ["CLAUDE_MAID_LANG"]


class ShiftTest(CafeTest):
    def test_priority_env_session_config(self):
        self.assertIsNone(maidstate.on_shift("sid"))
        set_config({"maid": "kokona"})
        self.assertEqual(maidstate.on_shift("sid"), "kokona")
        write(f"{CAFE}/sessions/sid/on-shift", "kurumi")
        self.assertEqual(maidstate.on_shift("sid"), "kurumi")
        os.environ["CLAUDE_MAID"] = "KOTONE"  # env wins, lowercased
        try:
            self.assertEqual(maidstate.on_shift("sid"), "kotone")
        finally:
            del os.environ["CLAUDE_MAID"]

    def test_none_means_nobody(self):
        set_config({"maid": "none"})
        self.assertIsNone(maidstate.on_shift("sid"))


class PersonaTest(CafeTest):
    def test_user_file_wins_over_bundled(self):
        write(f"{CAFE}/personas/noname.md", "---\nname: My Maid\n---\nMine.\n")
        self.assertEqual(maidstate.display_name("noname"), "My Maid")
        self.assertEqual(maidstate.persona_body(
            maidstate.persona_file("noname")).strip(), "Mine.")

    def test_retirement_stub_does_not_shadow_explicit_pick(self):
        write(f"{CAFE}/personas/noname.md", "---\noff_duty: true\n---\n")
        path = maidstate.persona_file("noname")
        self.assertTrue(path.startswith(f"{FAKE_PLUGIN}/maids"))
        self.assertIn("no name", maidstate.persona_body(path))

    def test_missing_persona(self):
        self.assertIsNone(maidstate.persona_file("ghost"))
        self.assertEqual(maidstate.display_name("ghost"), "Ghost")


class CastPoolTest(CafeTest):
    def test_empty_cafe_falls_back_to_noname(self):
        self.assertEqual(load_persona.cast_pool(), ["noname"])

    def test_hiring_anyone_relieves_noname(self):
        write(f"{CAFE}/personas/mymaid.md", "---\nname: M\n---\nbody\n")
        self.assertEqual(load_persona.cast_pool(), ["mymaid"])

    def test_everyone_retired_brings_noname_back(self):
        for value in ("true", "True", "yes"):
            write(f"{CAFE}/personas/mymaid.md", f"---\noff_duty: {value}\n---\n")
            self.assertEqual(load_persona.cast_pool(), ["noname"], value)

    def test_stub_retires_noname_too(self):
        write(f"{CAFE}/personas/noname.md", "---\noff_duty: true\n---\n")
        self.assertEqual(load_persona.cast_pool(), [])

    def test_uppercase_filename_skipped(self):
        write(f"{CAFE}/personas/MyMaid.md", "---\nname: M\n---\nbody\n")
        self.assertEqual(load_persona.cast_pool(), ["noname"])

    def test_builtin_cast_false(self):
        set_config({"builtin_cast": False})
        self.assertEqual(load_persona.cast_pool(), [])
        write(f"{CAFE}/personas/mymaid.md", "---\nname: M\n---\nbody\n")
        self.assertEqual(load_persona.cast_pool(), ["mymaid"])


class FestivalTest(CafeTest):
    def test_builtin_pack_by_default(self):
        import datetime
        self.assertEqual(festival.today_festivals(datetime.date(2026, 5, 10)),
                         ["Maid Day (メイドの日)"])
        self.assertEqual(festival.today_festivals(datetime.date(2026, 9, 2)), [])

    def test_config_false_disables(self):
        import datetime
        set_config({"festivals": False})
        self.assertEqual(festival.today_festivals(datetime.date(2026, 5, 10)), [])

    def test_custom_pack_replaces(self):
        import datetime
        write(f"{CAFE}/pack.json", '{"05-10": "掃除の日"}')
        set_config({"festivals": f"{CAFE}/pack.json"})
        self.assertEqual(festival.today_festivals(datetime.date(2026, 5, 10)),
                         ["掃除の日"])
        self.assertEqual(festival.today_festivals(datetime.date(2026, 2, 14)), [])

    def test_malformed_packs_degrade_to_silence(self):
        import datetime
        day = datetime.date(2026, 5, 10)
        set_config({"festivals": f"{CAFE}/nope.json"})  # missing file
        self.assertEqual(festival.today_festivals(day), [])
        set_config({"festivals": f"{CAFE}/pack.json"})
        write(f"{CAFE}/pack.json", '["05-10"]')  # non-object
        self.assertEqual(festival.today_festivals(day), [])
        write(f"{CAFE}/pack.json", '{"05-10": 42}')  # non-string value
        self.assertEqual(festival.today_festivals(day), [])


class StatusLinesTest(CafeTest):
    def test_nobody_on_shift(self):
        self.assertEqual(maidstate.status_lines("sid"), [])

    def test_bare_name_before_first_look(self):
        write(f"{CAFE}/sessions/sid/on-shift", "noname")
        self.assertEqual(maidstate.status_lines("sid"), ["？？？"])

    def test_look_rows_and_quote_wrap(self):
        write(f"{CAFE}/sessions/sid/on-shift", "kurumi")
        write(f"{CAFE}/sessions/sid/look.txt", "scene\nhello master\n")
        self.assertEqual(maidstate.status_lines("sid"), ["scene", "「hello master」"])
        write(f"{CAFE}/sessions/sid/look.txt", "scene\n「already quoted」\n")
        self.assertEqual(maidstate.status_lines("sid")[1], "「already quoted」")


class TranscriptStatsTest(CafeTest):
    def _transcript(self, entries):
        path = f"{TEST_HOME}/transcript.jsonl"
        write(path, "\n".join(json.dumps(e) for e in entries) + "\n")
        return path

    def test_work_turn_with_mood(self):
        path = self._transcript([
            {"type": "user", "message": {"content": "fix the bug"}},
            {"type": "assistant", "message": {
                "usage": {"input_tokens": 1000},
                "content": [
                    {"type": "tool_use", "name": "Bash"},
                    {"type": "text",
                     "text": "done 【 proud ᕙ( •̀ ᗜ •́)ᕗ 】"}]}},
        ])
        turns, tasks, tools, ctx, mood, worked = look_update.transcript_stats(path)
        self.assertEqual((turns, tasks, tools, ctx, worked),
                         (1, ["fix the bug"], {"Bash": 1}, 1000, True))
        self.assertEqual(mood, "proud ᕙ( •̀ ᗜ •́)ᕗ")

    def test_chat_only_turn(self):
        path = self._transcript([
            {"type": "user", "message": {"content": "how are you"}},
            {"type": "assistant", "message": {
                "usage": {"input_tokens": 500},
                "content": [{"type": "text", "text": "fine!"}]}},
        ])
        turns, tasks, tools, ctx, mood, worked = look_update.transcript_stats(path)
        self.assertEqual((tools, mood, worked), ({}, "neutral", False))

    def test_missing_transcript(self):
        self.assertEqual(look_update.transcript_stats("/nope"),
                         (0, [], {}, 0, "neutral", False))


class PromptTemplateTest(CafeTest):
    def test_substitution_survives_literal_dollar(self):
        write(f"{FAKE_PLUGIN}/prompts/t.md", "Hi $name, cost $5, $missing stays\n")
        self.assertEqual(maidstate.prompt("t", name="kurumi"),
                         "Hi kurumi, cost $5, $missing stays")


class HookProcessTest(CafeTest):
    """The few things worth checking through the real process boundary."""

    def _run(self, script, stdin="{}", env=None, argv=()):
        e = dict(os.environ)
        e.update(env or {})
        return subprocess.run(
            ["python3", f"{PLUGIN}/{script}", *argv],
            input=stdin, capture_output=True, text=True, env=e)

    def test_load_persona_explicit_pick(self):
        write(f"{CAFE}/personas/testmaid.md", "---\nname: T\n---\nTest persona body.\n")
        r = self._run("hooks/load-persona.py", env={"CLAUDE_MAID": "testmaid"})
        self.assertIn("Test persona body.", r.stdout)
        self.assertNotIn("---", r.stdout)  # frontmatter stripped
        self.assertIn(maidstate.DEFAULT_LANG, r.stdout)

    def test_sub_session_guard(self):
        for script in ("hooks/load-persona.py", "hooks/session-greeting.py"):
            r = self._run(script, env={"CLAUDE_MAID_SUB": "1",
                                       "CLAUDE_MAID": "kurumi"})
            self.assertEqual((r.returncode, r.stdout.strip()), (0, ""), script)

    # The feature toggles run with PATH restricted to system dirs, so even a
    # broken toggle can't reach a real `claude` — diary then degrades to its
    # mechanical fallback line, which the assertion catches.
    SYS_PATH = {"PATH": "/usr/bin:/bin"}

    def test_greeting_toggle_silences_but_still_tidies(self):
        set_config({"greeting": False})
        r = self._run("hooks/session-greeting.py",
                      stdin=json.dumps({"session_id": "greet-sid"}),
                      env=self.SYS_PATH)
        self.assertEqual((r.returncode, r.stdout), (0, ""))
        # the briefing is silenced, but the shift clock still gets stamped
        self.assertTrue(os.path.exists(f"{CAFE}/sessions/greet-sid/started-at"))

    def test_diary_toggle_writes_nothing(self):
        set_config({"diary": False, "maid": "testmaid"})
        transcript = f"{TEST_HOME}/toggle-transcript.jsonl"
        write(transcript, json.dumps(
            {"type": "user", "message": {"content": "hello maid"}}) + "\n")
        r = self._run("hooks/diary-write.py",
                      stdin=json.dumps({"session_id": "d-sid",
                                        "transcript_path": transcript}),
                      env=self.SYS_PATH)
        self.assertEqual(r.returncode, 0)
        self.assertFalse(os.path.exists(maidstate.DIARY))

    def test_look_toggle_skips_before_any_state(self):
        set_config({"look": False, "maid": "testmaid"})
        r = self._run("hooks/look-update.py",
                      stdin=json.dumps({"session_id": "look-sid"}),
                      env=self.SYS_PATH)
        self.assertEqual(r.returncode, 0)
        # bails before state_dir(create=True), so the session dir never appears
        self.assertFalse(os.path.exists(f"{CAFE}/sessions/look-sid"))

    def test_statusbar_row_args(self):
        write(f"{CAFE}/sessions/sid/on-shift", "testmaid")
        write(f"{CAFE}/sessions/sid/look.txt", "scene\nline\n")
        payload = json.dumps({"session_id": "sid"})
        for argv, want in ((), "scene\n「line」\n"), (("1",), "scene\n"), \
                          (("2",), "「line」\n"), (("row2",), ""), (("0",), ""):
            r = self._run("bin/statusbar.py", stdin=payload, argv=argv)
            self.assertEqual((r.returncode, r.stdout, r.stderr), (0, want, ""), argv)


if __name__ == "__main__":
    unittest.main(verbosity=2)
