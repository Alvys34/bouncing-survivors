import { PinballTable } from './pinball/pinballTable.ts';

console.log('=== RUNNING 10 AUTOMATED PINBALL GAMEPLAY TESTS ===\n');

let totalTestsPassed = 0;

for (let gameIndex = 1; gameIndex <= 10; gameIndex++) {
  let weaponTriggerCount = 0;
  const triggersRecorded: string[] = [];

  const table = new PinballTable((type, ballType, combo) => {
    weaponTriggerCount++;
    triggersRecorded.push(`${type} (x${combo.toFixed(1)}, ${ballType})`);
  });

  // Table dimensions matching 48% of 1920x1080
  const width = 1920 * 0.48; // 921.6
  const height = 1080;
  table.resize(width, height);

  const playW = width - table.plungerWidth;

  // Verify initial ball placement in plunger lane
  if (table.balls.length === 0) {
    throw new Error(`Game ${gameIndex}: No ball spawned!`);
  }
  const initialBall = table.balls[0];
  if (initialBall.x <= playW) {
    throw new Error(`Game ${gameIndex}: Ball is not in plunger lane! x=${initialBall.x}, playW=${playW}`);
  }
  const initialY = initialBall.y;

  // 1. Charge plunger for 0.35s
  table.startChargingPlunger();
  for (let frame = 0; frame < 20; frame++) {
    table.update(1 / 60);
  }

  if (table.plungerTension <= 0) {
    throw new Error(`Game ${gameIndex}: Plunger failed to charge!`);
  }

  // 2. Release plunger!
  table.releasePlunger();

  // 3. Step simulation and verify upward launch
  let launchedOutOfLane = false;
  let reachedTopArch = false;
  let minLaunchY = initialY;

  // Run up to 600 frames (10 seconds of gameplay)
  for (let frame = 0; frame < 600; frame++) {
    const dt = 1 / 60;

    // AI Flipper Agent: flip when ball is in the flipper strike zone
    for (const b of table.balls) {
      if (b.y > height * 0.84 && b.y < height * 0.91) {
        if (b.x < playW * 0.5) {
          table.setLeftFlipper(true);
        } else if (b.x < playW) {
          table.setRightFlipper(true);
        }
      } else {
        table.setLeftFlipper(false);
        table.setRightFlipper(false);
      }
    }

    table.update(dt);

    for (const b of table.balls) {
      if (b.y < minLaunchY) {
        minLaunchY = b.y;
      }
      if (b.y < 140) {
        reachedTopArch = true;
      }
      if (b.x < playW && reachedTopArch) {
        launchedOutOfLane = true;
      }
    }

    // At frame 100, add multiball frenzy to simulate full chaotic arcade action
    if (frame === 100) {
      table.addMultiball(2);
    }

    // Run for 400 frames so balls bounce around bumpers, slingshots, and flippers!
    if (launchedOutOfLane && frame > 400 && weaponTriggerCount > 0) {
      break;
    }
  }

  if (!reachedTopArch) {
    throw new Error(`Game ${gameIndex} FAILED: Ball never reached top arch! minLaunchY=${minLaunchY.toFixed(1)}, initialY=${initialY.toFixed(1)}`);
  }

  if (!launchedOutOfLane) {
    throw new Error(`Game ${gameIndex} FAILED: Ball reached top arch but did not exit into playfield! minLaunchY=${minLaunchY.toFixed(1)}`);
  }

  totalTestsPassed++;
  console.log(`[PASS] Game ${gameIndex}/10:`);
  console.log(`       - Ball Launched from Y=${initialY.toFixed(0)} to Top Arch Y=${minLaunchY.toFixed(0)}`);
  console.log(`       - Cleanly entered Playfield (x < ${playW.toFixed(0)})`);
  console.log(`       - Weapons triggered: ${weaponTriggerCount} [${triggersRecorded.slice(0, 3).join(', ')}${triggersRecorded.length > 3 ? '...' : ''}]`);
  console.log(`       - Table Score: ${table.score}, Combo: x${table.comboMultiplier.toFixed(1)}\n`);
}

console.log(`=== ALL ${totalTestsPassed}/10 GAMES PASSED VERIFICATION PERFECTLY! ===`);
