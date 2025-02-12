document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('questionnaire-form');
  const questionContainer = document.getElementById('question-container');
  const submitButton = document.getElementById('submit-button');
  const timeLimitInput = document.getElementById('time-limit');

  let questions = [];
  let currentQuestionIndex = 0;
  let contextData = {};

  function displayQuestion() {
    if (currentQuestionIndex < questions.length) {
      questionContainer.innerText = questions[currentQuestionIndex];
    } else {
      submitButton.disabled = false;
    }
  }

  function fetchQuestions() {
    // Fetch questions from the background script
    chrome.runtime.sendMessage({ type: 'getQuestions' }, function (response) {
      questions = response.questions;
      displayQuestion();
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const answer = document.getElementById('answer').value;
    const timeLimit = parseInt(timeLimitInput.value, 10);

    if (currentQuestionIndex < questions.length) {
      contextData[questions[currentQuestionIndex]] = answer;
      currentQuestionIndex++;
      displayQuestion();
    } else {
      // Send answers and time limit to the background script
      chrome.runtime.sendMessage(
        {
          type: 'unblock',
          contextData: contextData,
          timeLimit: timeLimit,
        },
        function (response) {
          if (response.status === 'unblocked') {
            alert('Websites are now unblocked for the specified time limit.');
          }
        }
      );
    }
  });

  fetchQuestions();
});
