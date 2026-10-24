# WNI (Why not, indeed?)

**Fourteen quick games. Four opponents. One panic button.**

WNI is a small collection of browser games for the slow part of the day. Every game is short, playful and a little bit strange: you do not just beat a level, you outsmart an opponent that reacts to what you do. Ten games are puzzles and duels you win or lose; four are endless, where you chase the best score you can until it is game over. The same four robot opponents appear in every game, from a friendly warm-up to one that is billed as impossible. Make an account and every run you finish lands on a shared leaderboard.

And if someone walks past your desk, press **B**: the screen turns into a dull budget spreadsheet.

How to run your own copy is in [DEPLOY.md](DEPLOY.md).

---

## Playing

Open the site and pick a game card in the lobby, or go straight to a game's address:

| Address | Page |
|---|---|
| `/` | The lobby |
| `/bury-the-bot`, `/fool-the-model`, `/excel-dungeon`, `/sock-trap`, `/spot-kick` | Games 1 to 5 |
| `/sneaky-hangman`, `/herd-instinct`, `/coffee-spill`, `/copycat`, `/echo` | Games 6 to 10 |
| `/going-up`, `/cable-spaghetti`, `/dont-click-that`, `/badge-check` | Games 11 to 14 (endless) |
| `/leaderboard` | Rankings, per game or all games, filtered by opponent |
| `/account` | Log in, sign up, and your best runs |
| `/credits` | Credits and licenses |

Every game works with a keyboard, a mouse, or a touch screen, and fits a phone.

## The opponents

Each game has the same four levels.

| Level | Rank | What to expect | Points multiplier |
|---|---|---|---|
| **Pip** | Rookie | Eager and a bit clumsy. The perfect warm-up. | x1 |
| **Ted** | Pro | Steady and careful. Makes very few mistakes. | x2 |
| **Excel** | Grandmaster | Plans ahead and reads your moves. A real fight. | x3 |
| **Edith** | Impossible | Small, cheerful, and has never lost. Every Edith level has been checked to be winnable, but expect to lose a lot. | x5 |

In the four endless games nobody wins: the opponent makes your run harder in its own way, and stars mark how far you got (for example 40, 90 and 150 riders in Going Up).

## The games

### 1. Bury the Bot
Falling blocks, upside down. You choose which piece the robot gets from a hand of three cards; the robot places it as well as it can. Get its stack above the red line before your pieces run out. Point at a card to see exactly where the robot will drop it, and spend mischief points on tricks: a junk row, a shove, a spin lock, or a fresh hand.
**Keys:** `1` `2` `3` deal a card, `Q` `W` `E` `R` tricks, `N` new deal.

### 2. Fool the Model
A sorting robot reads handwritten numbers on letters. Change as few pixels as you can so it reads the wrong number (on harder levels, a specific wrong number). Each opponent is a real trained model, and the stronger ones were trained against tricks like yours.
**Keys:** `1` to `4` pens, `Z` undo, `H` hint, `Enter` next letter.

### 3. Excel Dungeon
A cartoon dungeon crawl through a spreadsheet. Walk into error monsters to bonk them, grab coffee to heal, staplers for attack and binder shields for defense, and beat the boss on the last sheet.
**Keys:** arrows or `WASD` move and bonk, `Space` wait, `Q` drink coffee, `N` new dungeon.

### 4. Sock Trap
A robot vacuum wants to clean the whole office. Place chairs (they block), cables (they tangle it up) and socks (they jam its brush), then let it loose and toss more socks while it runs. Keep enough of the floor dirty until its battery dies. The smarter vacuums map the room and see your traps coming. A match is five offices, and every office is a brand new floor plan (rooms, doorways and furniture are different every time): keep enough dirt in at least three of them to win the match.
**Keys:** `1` chair, `2` cable, `3` sock, `4` pick up, `Enter` let it loose (or go to the next office), `P` pause, `F` speed, `R` clear items, `N` new match.

### 5. Spot Kick
A penalty shootout against a keeper that learns your habits. Pick a spot in the goal, stop the power needle in the green, then dive when it is the robot's turn to shoot. Favorite corners and patterns get noticed; Edith runs several mind readers at once and follows the one reading you best.
**Keys:** `Q` `W` `E` top spots, `A` `S` `D` low spots, `Space` strike, `N` new shootout.

### 6. Sneaky Hangman
Hangman in reverse. The robot guesses letters, and you decide how to answer. The trick: your secret word may quietly change at any time, as long as it still fits everything you have shown. Every wrong guess pops one of the robot's balloons; pop them all and it drops into the jelly. The words come fresh from an online word service.
**Keys:** `1` to `9` pick an answer, `N` new word.

### 7. Herd Instinct
You are the sheepdog. Get enough of the flock into the pen before time runs out. Sheep run from the dog and follow their lead sheep, who has plans of her own. Sneak to keep them calm, bark to scatter them. Edith's flock panics easily, and there is a wolf.
**Keys:** arrows or `WASD` (or the pointer) move, `Shift` sneak, `Space` bark, `Enter` start, `P` pause, `N` new field.

### 8. Coffee Spill
The robot is about to pour a whole pot of coffee over your desk. Draw walls with your pen so the coffee runs into the mugs instead of the laptop. Ink is limited, the eraser gives it back, and the robot slides along looking for any gap you left.
**Keys:** `1` pen, `2` eraser, `Enter` pour now, `R` clear ink, `P` pause, `N` new desk.

### 9. Copycat
A dance-off on a light-up floor. Every tile you dance on turns your color, and stepping on the robot's tiles steals them back. The robot copies your moves a few beats later from wherever it stands, with a wider paint roller. Plan moves that are good for you now but walk it into speakers and open trapdoors later. The floor wraps around at the edges.
**Keys:** arrows or `WASD` dance, `Space` stay put, `N` new dance.

### 10. Echo
A pitch-black maze. You only see a wall for a moment after a ping bounces off it, or after you bump into it. Find the keycards, then the exit, before your steps run out, while the robot maze keeper quietly moves walls. Edith listens for your pings: stay quiet and she loses track of you.
**Keys:** arrows or `WASD` move, `Space` ping, `N` new maze.

### 11. Going Up (endless)
You run the elevator in an office tower, and the working day never ends. People appear on the floors with a bubble showing where they want to go. Press floor buttons to line up your stops; at each stop riders get out and waiting people get in (six at most). A robot elevator works the next shaft and snaps up riders too, but only the happy ones (green rings), so the grumpy ones are always yours. Morning, lunch and home-time rushes keep coming, and the tower grows from 6 to 10 floors. The shift ends when three people give up and take the stairs. Edith races you to your next stop whenever she can get there first, and waits where the next rush begins.
**Keys:** `1` to `9` add or cancel a stop, `0` or `G` the ground floor, `Enter` start, `P` pause, `N` new shift.

### 12. Cable Spaghetti (endless)
The robot IT team keeps dropping gadgets on your desk, and every one needs a cable. Drag from the new device, square by square, to a free socket of its kind: yellow cables go to power strips, green ones to USB hubs. Cables can never cross. Some devices go home after a while (the red number) and free their cable, new strips arrive and the desk grows, but the cables pile up. Short cables leave room for later; the shortest possible one counts as a neat cable. Out of room? Snip a cable with the scissors and route it again. The desk is done when a device has nowhere to plug in. Edith drops devices on the square that cuts off the most free desk, and keeps moving the spare strips she brings until you use them.
**Keys:** arrows or `WASD` lay the cable, `Backspace` undo a square, `Esc` start the cable over, `C` scissors, `N` new desk.

### 13. Don't Click That (endless)
A robot has taken over the office computer's mouse and wants to click the big red **Delete everything** button. Drag the open windows into its way: the pointer cannot pass through a window, so it has to go around. Walled in, it closes a window instead (its X glows yellow while it works), and the smarter pointers also close one whenever going round takes too long. Drop a window right over the button and it has to close that one first. Windows close by themselves after a while, new pop-ups keep appearing, the button jumps now and then, and the pointer keeps speeding up. It also drags files to the trash: a file under a window is safe, and while a window covers the trash it has to close that window first. Every 30 seconds a backup pays for the files you still have. The run ends when it clicks. Edith fakes a move one way before darting the other.
**Keys:** drag windows with the mouse or a finger, `Enter` start, `P` pause, `N` new run.

### 14. Badge Check (endless)
You guard the office turnstile, and a robot forger slips fake badges into the queue. A real badge gets five things right: the photo is the person in front of you, the name is in the staff directory exactly as spelled, the floor matches that department in the floor chart, its valid-until date (year included) is not before today, and it carries this week's stamp. Today is the date on your own computer, and a badge still counts on its last day. Let the real coworkers in and stop the fakes before the timer runs out; the timer gets shorter as the queue grows. Three mistakes (a fake let in, a real coworker turned away, or too slow) end the shift. The forger learns which details slip past you; Edith also notices when you decide in a hurry and fakes the details that take longest to check.
**Keys:** `←` or `S` stop, `→` or `L` let in, `Enter` start, `P` pause (the badge hides while paused), `N` new shift.

## Everywhere

| Key | What it does |
|---|---|
| `B` | Panic button. Swaps the screen for a dull budget spreadsheet, pauses anything running and silences all sound. Press `B` again to come back. |
| `M` | Music on or off. Every game has its own soundtrack. |
| `?` | How to play the current game. |

Music and sound effects start off; the **Music** and **Sound** buttons in every game's top bar turn them on. Once on, the music keeps playing as you move around the site: the lobby tune carries on through the leaderboard and your account page, each game's tune fades in when you open it, and every tune picks up where you left it.

## Accounts, points and the leaderboard

- **Sign up** with a username, email and password. **Log in** with your email or your username, plus your password (capitals do not matter).
- Every run you finish scores points: the game's own score, multiplied by the opponent (Pip x1, Ted x2, Excel x3, Edith x5).
- Finished a run before logging in? Log in within 30 minutes and that run is saved for you.
- The leaderboard ranks everyone's best run in each game, or adds up each player's best across all fourteen games, and can be filtered by opponent.

| Game | How its points are earned |
|---|---|
| Bury the Bot | 400 for burying the robot, 20 per unused piece, 100 per star. A loss earns 10 per row of its tallest stack. |
| Fool the Model | 150 per fooled letter, 10 per pixel saved, and 300 plus 100 per star for clearing the sack. |
| Excel Dungeon | Every coin, 100 per hero level, 150 per sheet reached, and 600 plus 4 per health point for beating the boss. |
| Sock Trap | In each of the five offices: 20 per percent of floor left dirty, plus 200 and 30 per unused item if you win that office. Winning the match (three offices or more) adds 500 plus 100 per star (stars for 3, 4 or 5 offices won). |
| Spot Kick | 120 per goal, 100 per save, and 500 for winning the shootout. |
| Sneaky Hangman | 60 per wrong guess forced, 40 per letter still hidden, and 500 for a win. |
| Herd Instinct | 100 per sheep penned, and for a win 500 plus 5 per second left. |
| Coffee Spill | 3 per drop caught, minus 5 per drop on the laptop, and for a win 500 plus 4 per unit of ink left. |
| Copycat | 12 per tile you own, 40 each time the robot falls, and for a win 500 plus 30 per tile of lead. |
| Echo | 200 per keycard, and for escaping 500 plus 10 per step and 25 per ping left. |
| Going Up | 10 per rider delivered, and 10 more for each quick trip (under 20 seconds from pressing the button to arriving). |
| Cable Spaghetti | 10 per device plugged in, and 5 more for each neat cable (the shortest one possible). |
| Don't Click That | 10 per second you hold the pointer off, and 100 per file still on the desktop at every backup (every 30 seconds). |
| Badge Check | 10 per correct call, 2 more per call in your current streak (up to 20), and 5 more for a quick call (with half the timer left). |

## Credits

All music, sound effects, art and games were made for WNI. Sneaky Hangman's online words come from the [Datamuse API](https://www.datamuse.com/api/). The fonts, the backup word list and the handwritten digits used by Fool the Model are credited on the site's `/credits` page and in [DEPLOY.md](DEPLOY.md).
