const message = document.querySelector('#loginMessage');
const params = new URLSearchParams(window.location.search);
const error = params.get('error');

const messages = {
  missing: 'Choose a user and enter a login code.',
  login: 'That login did not work. Check the user and code, then try again.'
};

if (message && error && messages[error]) {
  message.textContent = messages[error];
}
