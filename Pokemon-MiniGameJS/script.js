// This event listener ensures that the script runs only after the DOM has fully loaded
document.addEventListener("DOMContentLoaded", function () {

  // Getting references to various elements in the HTML document
  const gameContainer = document.getElementById("game-container");
  const player = document.getElementById("player");
  const enemiesContainer = document.createElement("div");
  enemiesContainer.id = "enemies-container";
  gameContainer.appendChild(enemiesContainer);

  // Setting up initial variables and arrays for game logic
  const playerSpeed = 2;
  const enemySpeed = 1;
  const bulletSpeed = 5;
  let playerX = gameContainer.offsetWidth / 2;
  let playerY = gameContainer.offsetHeight / 2;
  let keys = {};
  let bullets = [];
  let score = 0;
  let scoreElement = document.getElementById("score");
  let lives = 3;
  let livesContainer = document.getElementById("lives-container");
  let lifeElements = document.getElementsByClassName("life");

  // Handling keyup events to update the 'keys' object
  document.addEventListener("keyup", function (event) {
    keys[event.key] = false;
  });

  // Function to update the visual representation of remaining lives
  function updateLivesVisuals() {
    for (let i = 0; i < lives; i++) {
      if (i < lives) {
        lifeElements[i].style.opacity = 1; // Show life
      } else {
        lifeElements[i].style.opacity = 0; // Hide life
      }
    }
  }

  // Functions to handle collision with the player
  let boolean = false;
  function cambio() {
    boolean = false;
  }
  function checkPlayerCollision(enemy) {
    const playerRect = player.getBoundingClientRect();
    const enemyRect = enemy.getBoundingClientRect();

    if (
      playerRect.left < enemyRect.left + enemyRect.width &&
      playerRect.left + playerRect.width > enemyRect.left &&
      playerRect.top < enemyRect.top + enemyRect.height &&
      playerRect.top + playerRect.height > enemyRect.top
    ) {
      if (lives > 0 && boolean == false) {
        lives--; // Decrease a life
        lifeElements[lives].style.opacity = 0;
        boolean = true;
        console.log(lives);
        setInterval(cambio, 1000);
        perder();
      }
    }
  }

  // Function to handle the game over scenario
  function perder() {
    if (lives == 0) {
      gameOver("Has perdido");
      return;
    }
  }

  // Function to move the player based on keyboard input
  function movePlayer() {
    // Code to update player position based on keyboard input
    // ...

    // Update the visual position of the player
    player.style.left = playerX + "px";
    player.style.top = playerY + "px";
  }

  // Handling keydown events to update the 'keys' object and shoot bullets
  document.addEventListener("keydown", function (event) {
    keys[event.key] = true;
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    ) {
      shoot(event.key);
    }
  });

  // Function to create and shoot bullets in the specified direction
  function shoot(direction) {
    // Code to create and shoot bullets
    // ...
  }

  // Function to move a bullet based on its speed and check for collisions
  function moveBullet(bullet, speedX, speedY) {
    // Code to move the bullet
    // ...
  }

  // Function to check for collisions between bullets and enemies
  function checkBulletCollision(bullet) {
    // Code to check for bullet collisions with enemies
    // ...
  }

  // Function to create enemy elements and set their initial properties
  function createEnemy() {
    // Code to create enemies
    // ...
  }

  // Function to handle the movement of enemies
  function moveEnemy() {
    // Code to move enemies
    // ...
  }

  // Function to handle the game over scenario and display a message
  function gameOver(message) {
    alert(message); // Display an alert with the game over message
    location.reload(); // Reload the page to restart the game
  }

  // Function to check if the player has achieved a certain score to win the game
  function scoreCheck() {
    if (score >= 100) {
      gameOver("Has ganado");
      return;
    }
  }

  // Setting up intervals to continuously update and run various game functions
  setInterval(movePlayer, 10); // Update player position
  setInterval(createEnemy, 500); // Create enemies at intervals
});
