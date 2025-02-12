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

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type === 'displayQuestions') {
      questions = request.questions;
      currentQuestionIndex = 0;
      displayQuestion();
    } else if (request.type === 'displayErrorMessage') {
      alert(request.message);
    }
  });

  function fetchQuestions() {
    // Fetch questions from the Python script
    fetch('http://localhost:5000/getQuestions')
      .then(response => response.json())
      .then(data => {
        questions = data.questions;
        displayQuestion();
      })
      .catch(error => console.error('Error fetching questions:', error));
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
      // Send answers and time limit to the background script for contextualization
      chrome.runtime.sendMessage(
        {
          type: 'questionnaireComplete',
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
