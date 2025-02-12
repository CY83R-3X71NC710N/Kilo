document.addEventListener('DOMContentLoaded', function () {
  const setDomainButton = document.getElementById('setDomain');
  const domainSelect = document.getElementById('domain');

  setDomainButton.addEventListener('click', function () {
    const selectedDomain = domainSelect.value;

    chrome.runtime.sendMessage(
      { type: 'setDomain', domain: selectedDomain },
      function (response) {
        if (response && response.status === 'domainSet') {
          alert(`Domain set to ${selectedDomain}. Please answer the questions.`);
        } else {
          alert('Failed to set domain.');
        }
      }
    );
  });
});