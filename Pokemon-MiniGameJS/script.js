// Wait for the HTML document to be fully loaded before executing the script
document.addEventListener("DOMContentLoaded", function () {
  // Get references to necessary elements in the HTML
  const gameContainer = document.getElementById("game-container");
  const player = document.getElementById("player");
  const enemiesContainer = document.createElement("div");
  enemiesContainer.id = "enemies-container";
  gameContainer.appendChild(enemiesContainer);

  // Define constants for player, enemy, and bullet speeds
  const playerSpeed = 2;
  const enemySpeed = 1;
  const bulletSpeed = 5;

  // Initialize player's position
  let playerX = gameContainer.offsetWidth / 2;
  let playerY = gameContainer.offsetHeight / 2;

  // Track keyboard keys and bullet instances
  let keys = {};
  let bullets = [];

  // Initialize score-related variables
  let score = 0;
  let scoreElement = document.getElementById("score");

  // Initialize lives-related variables
  let lives = 3;
  let livesContainer = document.getElementById("lives-container");
  let lifeElements = document.getElementsByClassName("life");

  // Listen for keyup events to track released keys
  document.addEventListener("keyup", function (event) {
    keys[event.key] = false;
  });

  // Update the visual representation of lives
  function updateLivesVisuals() {
    for (let i = 0; i < lives; i++) {
      if (i < lives) {
        lifeElements[i].style.opacity = 1; // Show life
      } else {
        lifeElements[i].style.opacity = 0; // Hide life
      }
    }
  }

  // Helper function to reset a boolean variable
  let boolean = false;
  function cambio() {
    boolean = false;
  }

  // Check for collision with the player
  function checkPlayerCollision(enemy) {
    const playerRect = player.getBoundingClientRect();
    const enemyRect = enemy.getBoundingClientRect();

    if (
      playerRect.left < enemyRect.left + enemyRect.width &&
      playerRect.left + playerRect.width > enemyRect.left &&
      playerRect.top < enemyRect.top + enemyRect.height &&
      playerRect.top + playerRect.height > enemyRect.top
    ) {
      // Check if lives are remaining and a collision has not been detected recently
      if (lives > 0 && boolean == false) {
        lives--; // Decrease life count
        lifeElements[lives].style.opacity = 0; // Hide life visually
        boolean = true;
        console.log(lives);
        setInterval(cambio, 1000);
        perder(); // Check if the player has lost all lives
      }
    }
  }

  // Function to handle game-over condition
  function perder() {
    if (lives == 0) {
      gameOver("Has perdido");
      return;
    }
  }

  // Move the player based on pressed keys
  function movePlayer() {
    if (keys["a"]) {
      playerX -= playerSpeed;
      if (playerX < 0) {
        playerX = 0;
      }
    }
    if (keys["d"]) {
      playerX += playerSpeed;
      if (playerX > gameContainer.offsetWidth - player.offsetWidth) {
        playerX = gameContainer.offsetWidth - player.offsetWidth;
      }
    }
    if (keys["w"]) {
      playerY -= playerSpeed;
      if (playerY < 0) {
        playerY = 0;
      }
    }
    if (keys["s"]) {
      playerY += playerSpeed;
      if (playerY > gameContainer.offsetHeight - player.offsetHeight) {
        playerY = gameContainer.offsetHeight - player.offsetHeight;
      }
    }

    // Update player's position in the DOM
    player.style.left = playerX + "px";
    player.style.top = playerY + "px";
  }

  // Listen for keydown events to track pressed keys and shoot bullets
  document.addEventListener("keydown", function (event) {
    keys[event.key] = true;
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    ) {
      shoot(event.key); // Shoot a bullet in the direction of the arrow key
    }
  });

  // Function to create and shoot bullets
  function shoot(direction) {
    bullet = document.createElement("div");
    bullet.className = "bullet";
    bullet.x = playerX + player.offsetWidth / 2;
    bullet.y = playerY + player.offsetHeight / 2;
    bullet.style.left = bullet.x + "px";
    bullet.style.top = bullet.y + "px";

    gameContainer.appendChild(bullet);
    bullets.push(bullet);

    let bulletSpeedX = 0;
    let bulletSpeedY = 0;

    // Set bullet speed based on the arrow key pressed
    if (direction === "ArrowUp") {
      bulletSpeedY = -bulletSpeed;
    } else if (direction === "ArrowDown") {
      bulletSpeedY = bulletSpeed;
    } else if (direction === "ArrowLeft") {
      bulletSpeedX = -bulletSpeed;
    } else if (direction === "ArrowRight") {
      bulletSpeedX = bulletSpeed;
    }

    // Move the bullet at regular intervals
    bullet.moveInterval = setInterval(
      moveBullet,
      10,
      bullet,
      bulletSpeedX,
      bulletSpeedY
    );
  }

  // Move a bullet based on its speed
  function moveBullet(bullet, speedX, speedY) {
    bullet.x += speedX;
    bullet.y += speedY;
    bullet.style.left = bullet.x + "px";
    bullet.style.top = bullet.y + "px";

    // Check if the bullet is out of bounds
    if (
      bullet.x < 0 ||
      bullet.x > gameContainer.offsetWidth ||
      bullet.y < 0 ||
      bullet.y > gameContainer.offsetHeight
    ) {
      clearInterval(bullet.moveInterval);
      bullet.remove();
      bullets.splice(bullets.indexOf(bullet), 1);
    } else {
      checkBulletCollision(bullet); // Check for collision with enemies
    }
  }

  // Check for collision between bullets and enemies
  function checkBulletCollision(bullet) {
    const bulletRect = bullet.getBoundingClientRect();
    const enemies = document.getElementsByClassName("enemy");

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const enemyRect = enemy.getBoundingClientRect();

      if (
        bulletRect.left < enemyRect.left + enemyRect.width &&
        bulletRect.left + bulletRect.width > enemyRect.left &&
        bulletRect.top < enemyRect.top + enemyRect.height &&
        bulletRect.top + bulletRect.height > enemyRect.top
      ) {
        bullet.remove();
        bullets.splice(bullets.indexOf(bullet), 1);
        score++; // Increase the score by 1
        scoreElement.textContent = "Score:" + score; // Update the score display

        // Reduce enemy's health or remove it completely
        const health = enemy.getAttribute("data-health");
        if (health > 1) {
          enemy.setAttribute("data-health", health - 1);
        } else {
          enemy.remove();
        }

        break;
      }
    }
  }

  // Function to create enemy instances
  function createEnemy() {
    const enemy = document.createElement("img");

    // Randomly select an enemy image
    let n = parseInt(Math.random() * 3);
    if (n == 1) {
      enemy.src = "imgs/siccor.gif";
    } else if (n == 0) {
      enemy.src = "imgs/gengargif.gif";
    } else if (n == 2) {
      enemy.src = "imgs/slugmagif.gif";
    }
    enemy.className = "enemy";

    // Randomly determine the direction from which the enemy will appear
    const randomDirection = Math.random();

    if (randomDirection < 0.25) {
      // Appear from the left
      enemy.style.left = -enemy.offsetWidth + "px";
      enemy.style.top =
        Math.random() * (gameContainer.offsetHeight - enemy.offsetHeight) +
        "px";
      enemy.speedX = enemySpeed;
      enemy.speedY = 0;
    } else if (randomDirection < 0.5) {
      // Appear from the right
      enemy.style.left = gameContainer.offsetWidth + "px";
      enemy.style.top =
        Math.random() * (gameContainer.offsetHeight - enemy.offsetHeight) +
        "px";
      enemy.speedX = -enemySpeed;
      enemy.speedY = 0;
    } else if (randomDirection < 0.75) {
      // Appear from the top
      enemy.style.left =
        Math.random() * (gameContainer.offsetWidth - enemy.offsetWidth) + "px";
      enemy.style.top = -enemy.offsetHeight + "px";
      enemy.speedX = 0;
      enemy.speedY = enemySpeed;
    } else {
      // Appear from the bottom
      enemy.style.left =
        Math.random() * (gameContainer.offsetWidth - enemy.offsetWidth) + "px";
      enemy.style.top = gameContainer.offsetHeight + "px";
      enemy.speedX = 0;
      enemy.speedY = -enemySpeed;
    }

    // Move the enemy at regular intervals
    const enemyMoveInterval = setInterval(moveEnemy, 500 / 60);

    function moveEnemy() {
      const enemyX = parseInt(enemy.style.left);
      const enemyY = parseInt(enemy.style.top);
      const newEnemyX = enemyX + enemy.speedX;
      const newEnemyY = enemyY + enemy.speedY;

      // Check if the enemy is out of bounds
      if (
        newEnemyX < -enemy.offsetWidth ||
        newEnemyX > gameContainer.offsetWidth ||
        newEnemyY < -enemy.offsetHeight ||
        newEnemyY > gameContainer.offsetHeight
      ) {
        clearInterval(enemyMoveInterval);
        enemy.remove();
      } else {
        enemy.style.left = newEnemyX + "px";
        enemy.style.top = newEnemyY + "px";

        checkPlayerCollision(enemy); // Check for collision with the player
      }
    }

    // Add the enemy to the enemies container
    enemiesContainer.appendChild(enemy);
  }

  // Function to handle the game-over condition
  function gameOver(message) {
    // Stop the game (you can deactivate keyboard events or stop intervals)

    // Show the game-over message
    alert(message);
    location.reload(); // Reload the page to restart the game
  }

  // Function to check if the player has won the game
  function scoreCheck() {
    if (score >= 100) {
      gameOver("Has ganado");
      return;
    }
  }

  // Set intervals for player movement and enemy creation
  setInterval(movePlayer, 10);
  setInterval(createEnemy, 500);
});
