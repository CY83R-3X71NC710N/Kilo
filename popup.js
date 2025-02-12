document.addEventListener('DOMContentLoaded', function () {
  const setDomainButton = document.getElementById('setDomain');
  const domainSelect = document.getElementById('domain');

  setDomainButton.addEventListener('click', function () {
    const selectedDomain = domainSelect.value;
    chrome.runtime.sendMessage({ type: 'setDomain', domain: selectedDomain }, function (response) {
      if (response.status === 'domainSet') {
        alert('Domain has been set successfully.');
      }
    });
  });
});
