import {
  STORAGE_SESSION_KEY,
  buildArticleDraft,
  getConfig,
  saveArticle,
  signInWithPassword
} from './popup-core.js';

const authView = document.querySelector('#auth-view');
const saveView = document.querySelector('#save-view');
const authForm = document.querySelector('#auth-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const saveButton = document.querySelector('#save-button');
const signOutButton = document.querySelector('#sign-out-button');
const statusMessage = document.querySelector('#status-message');
const tabTitle = document.querySelector('#tab-title');
const tabUrl = document.querySelector('#tab-url');

let config;
let currentSession;
let currentTab;

function setStatus(message, kind = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message${kind ? ` ${kind}` : ''}`;
}

function setSignedIn(isSignedIn) {
  authView.hidden = isSignedIn;
  saveView.hidden = !isSignedIn;
}

async function getStoredSession() {
  const result = await chrome.storage.local.get(STORAGE_SESSION_KEY);
  return result[STORAGE_SESSION_KEY];
}

async function setStoredSession(session) {
  await chrome.storage.local.set({ [STORAGE_SESSION_KEY]: session });
}

async function clearStoredSession() {
  await chrome.storage.local.remove(STORAGE_SESSION_KEY);
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url) {
    throw new Error('Could not read the current tab.');
  }

  return tab;
}

function renderTab(tab) {
  tabTitle.textContent = tab.title || 'Current tab';
  tabUrl.textContent = tab.url || '';
}

async function bootstrap() {
  try {
    config = getConfig();
    currentTab = await getCurrentTab();
    renderTab(currentTab);
    currentSession = await getStoredSession();
    setSignedIn(Boolean(currentSession));
  } catch (error) {
    setSignedIn(false);
    setStatus(error instanceof Error ? error.message : 'Extension setup failed.', 'error');
  }
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Signing in...');

  try {
    currentSession = await signInWithPassword(config, emailInput.value, passwordInput.value);
    await setStoredSession(currentSession);
    passwordInput.value = '';
    setSignedIn(true);
    setStatus('Signed in.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not sign in.', 'error');
  }
});

saveButton.addEventListener('click', async () => {
  setStatus('Saving current tab...');

  try {
    const draft = buildArticleDraft(currentTab);
    await saveArticle(config, currentSession, draft);
    setStatus('Saved to your reading list.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not save current tab.', 'error');
  }
});

signOutButton.addEventListener('click', async () => {
  currentSession = undefined;
  await clearStoredSession();
  setSignedIn(false);
  setStatus('Signed out.');
});

void bootstrap();
