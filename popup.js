document.addEventListener('DOMContentLoaded', function () {
  const setDomainButton = document.getElementById('setDomain');
  const domainSelect = document.getElementById('domain');

  setDomainButton.addEventListener('click', function () {
    const selectedDomain = domainSelect.value;
  });
});
