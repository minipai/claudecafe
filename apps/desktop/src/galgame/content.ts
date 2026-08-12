/** This window is opened on one folder and stays there — same as a VS Code window. */
export const WORKING_DIRECTORY = '~/Dev/claudecafe'

export const GREETING =
  'ご主人様～有什麼吩咐嗎？想問問題、聊聊程式碼，還是要ことね去查個 bug 呢？'

export const IDLE_NUDGE =
  '嗯～？ご主人様有什麼想問的嗎？儘管在上面打字，或點下面的按鈕試試看喔！'

export const INTERRUPTED_LINE = '咦、被叫停了嗎…好、好的…'

export function permissionAskLine(command: string) {
  return `ご主人様，ことね想跑 \`${command}\`，可以嗎？`
}

export function editAskLine(filePath: string) {
  return `ことね想改 ${filePath} 這個檔案喔，先看一下改哪裡好不好～？`
}

export function planAskLine() {
  return '計畫排好了喔！ご主人様看看這樣走可以嗎？'
}

export const AGENT_ERROR_TITLE = 'ことね跌倒了…'

