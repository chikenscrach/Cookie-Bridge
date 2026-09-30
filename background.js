import {managerTabOptions} from './browser-context.mjs';

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.create(managerTabOptions(tab, chrome.runtime.getURL('manager.html'), chrome.extension.inIncognitoContext));
    if (Number.isInteger(tab.id) && tab.id >= 0) await chrome.action.setBadgeText({tabId:tab.id, text:''});
  } catch {
    // Do not fall back to another window if the clicked window closed.
    if (Number.isInteger(tab?.id) && tab.id >= 0) {
      await Promise.allSettled([
        chrome.action.setBadgeText({tabId:tab.id, text:'!'}),
        chrome.action.setTitle({tabId:tab.id, title:'無法在目前視窗開啟；請確認無痕權限後重試。'})
      ]);
    }
  }
});
