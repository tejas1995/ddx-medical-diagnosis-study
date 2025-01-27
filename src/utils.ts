import { ENABLE_TIMER } from './globals';

function paramsToObject(entries) {
  const result = {}
  // each 'entry' is a [key, value] tupple
  for (const [key, value] of entries) {
    result[key] = value;
  }
  return result;
}

let activeTimer: ReturnType<typeof setInterval> | null = null; // Timer interval

function startTimer(duration, stepDiv, buttons, callback, message) {
  if (!ENABLE_TIMER) {
      // If the timer is disabled, enable the buttons immediately
      buttons.forEach(button => button.removeAttribute("disabled"));
      if (callback) callback();
      return;
  }

  // Clear any existing timer to prevent multiple intervals
  if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
  }

  // Disable buttons
  buttons.forEach(button => button.setAttribute("disabled", "true"));
  
  // Show timer visually
  let timerDisplay = document.createElement('div');
  timerDisplay.id = `timer_${stepDiv.id}`;
  timerDisplay.style.fontWeight = 'bold';
  timerDisplay.style.marginTop = '10px';
  stepDiv.appendChild(timerDisplay);

  let remainingTime = duration;

  // Initial display
  timerDisplay.textContent = message + ` You can make your selection in ${remainingTime} second(s).`;

  activeTimer = setInterval(() => {
      remainingTime--;
      if (remainingTime >= 0) {
          timerDisplay.textContent = message + ` You can make your selection in ${remainingTime} second(s).`;
      } else {

          if (activeTimer !== null) {
              clearInterval(activeTimer); // Stop the timer
              activeTimer = null;
          }
          activeTimer = null;

          // Remove timer display
          stepDiv.removeChild(timerDisplay);

          // Enable buttons
          buttons.forEach(button => button.removeAttribute("disabled"));

          if (callback) callback();
      }
  }, 1000);
}

export { paramsToObject, startTimer };