# Skiftlista testguide

This guide shows you, step by step, how to check that the new Skiftlista leader page works. You do not need to know how to program. You will type a few commands that are written out for you, and then click around in the page and compare what you see with the pictures.

It takes about 30 minutes. The page uses invented people, nothing you do is saved, and you cannot break anything.

A version of this guide with pictures of what each step should look like, tick boxes and a "Copy my results" button is shared as a page by Morten. This file has the same steps as text.

## Words you will see

- **Ledig**: a free place on a shift
- **Skiftleder / SL**: shift leader
- **Skjenker**: bartender
- **vil / kan / kan ikke / ikke svart**: the person's answer for that shift: wants to / can if needed / cannot / has not answered
- **Sett inn**: put this person here
- **Angre**: undo
- **Publiser uka**: publish the week, so people see their shifts in the app
- **Folk denne uka**: the list of people on the right

## Part 1: Start the page

The page runs on your own computer. You start it from a window called Ubuntu, where you type commands, and then you look at it in Chrome.

Type each command exactly as written, one at a time, and press Enter after each. Tip: you can copy a command from this guide and paste it into the Ubuntu window with a right click.

### 1.1 Open the Ubuntu window

Do this:

1. Press the Windows key, type Ubuntu, and press Enter.

You should see:

- A black window opens with a line that ends with a $ sign. This is where you type commands.

- [ ] It matched

### 1.2 Go to the project folder

Do this:

1. Type this command and press Enter:

       cd ~/kvarteret/samfunnetibergen


You should see:

- Nothing much happens, but the line now ends with samfunnetibergen$.
- If it says "No such file or directory", the project is somewhere else on this computer. Ask Morten.

- [ ] It matched

### 1.3 Start the page

Do this:

1. Type this command and press Enter:

       npm run dev:skiftlista

2. Wait about 5 seconds.

You should see:

- You see the word VITE and a line saying Local: http://localhost:3190/
- Leave this window open. Closing it stops the page.
- If it says "Port 3190 is already in use" and stops, the page is already running somewhere else, usually started by Claude Code. That is fine: go to 1.4. But then step 1.5 will not stop it; it stops when that Claude Code session is closed.
- If it shows an error with words like "not found" or "Cannot find module", type the command below, press Enter, wait until it finishes (a few minutes), and then do 1.3 again:

       npm ci


- [ ] It matched

### 1.4 Open the page in Chrome

Do this:

1. Open Chrome (or Edge).
2. Click in the address bar at the top, type localhost:3190 and press Enter.

You should see:

- You see the page in the picture below: "Skiftlista" in red at the top left, a big "Uke 49", a grid of shifts, and a list of people on the right.
- If Chrome says it cannot reach the page, check that the Ubuntu window from 1.3 is still open and shows Local: http://localhost:3190/.

- [ ] It matched

### 1.5 When you are finished (do this at the very end)

Do this:

1. Click in the Ubuntu window and press Ctrl and C at the same time.

You should see:

- The line ending with $ comes back, and if you reload Chrome (F5) it says the page cannot be reached. You can close the Ubuntu window.
- If Chrome still shows the page, it was started somewhere else (see 1.3). That is not a problem with the page.

- [ ] It matched

## Part 2: Try it with the mouse

Before each test, press F5 on the keyboard. That reloads the page and puts everything back to the start, so each test begins the same way.

For each test: do the steps, compare with "You should see", and tick the box if it matched. If something was different, write a short note in the box under the test.

### 2.1 First look

Press F5 first, to start from the beginning.

Do this:

1. Just look at the page.

You should see:

- The big title says "Uke 49", with a yellow label "Utkast: ikke synlig i appen" next to it.
- Below it are four round buttons: "! 1 problem" (red), "7 advarsler", "12 ledige" and "4 uten skift".
- On the right is a box called "Folk denne uka" with a list of names.
- The colours and letters look like the samfunnetibergen.no website.

- [ ] It matched

### 2.2 Put a person on a shift

Press F5 first, to start from the beginning.

Do this:

1. In the box on the right, click the round button "Uten skift".
2. Click the name "Emil T." in the list.

You should see:

- Emil's row turns orange.
- Several free places in the grid now say "Sett inn Emil" with an orange dashed border.
- The free Skiftleder places say "bare godkjente skiftledere" instead, because Emil is not a shift leader.

- [ ] It matched

### 2.3 ...and place him

Do this:

1. Continue from 2.2. Click one of the places that says "Sett inn Emil".

You should see:

- A green message appears: "Emil T. er satt opp som skjenker, ...".
- The place now shows "Emil T.".
- Some places show a warning in yellow or red, for example "svarte kan ikke" (he answered that he cannot). That is expected: the page warns but still lets the leader decide.

- [ ] It matched

### 2.4 Undo

Do this:

1. Continue from 2.3. Click the button "Angre Emil T. satt inn" near the top right. (Or press Ctrl and Z at the same time.)

You should see:

- The message changes to "Emil T. er tatt av ...".
- The place says "Sett inn Emil" again.

- [ ] It matched

### 2.5 Start from a free place

Press F5 first, to start from the beginning.

Do this:

1. In the grid, find the column Torsdag (Thursday) and the row Dagskift. Click the top place there: it says SKIFTLEDER and Ledig.

You should see:

- The box on the right changes. Its title is "Skiftleder, torsdag 3. desember".
- It lists people under the headings Vil, Kan, Ikke svart and Kan ikke.
- Every name in the list ends with "· SL" (only shift leaders can take this place).

- [ ] It matched

### 2.6 ...and pick someone

Do this:

1. Continue from 2.5. Click "Iver K." in the box on the right.

You should see:

- A green message says Iver K. is placed.
- The box on the right goes back to the list of people, and the place shows "Iver K.".

- [ ] It matched

### 2.7 Remove a person

Press F5 first, to start from the beginning.

Do this:

1. Click "Kari B." in the grid (column Onsdag, the place with a red border).
2. In the box on the right, click "Fjern Kari B.".

You should see:

- A green message says "Kari B. er tatt av ...".
- The red round button "! 1 problem" at the top disappears.

- [ ] It matched

### 2.8 Move a person

Press F5 first, to start from the beginning.

Do this:

1. Click "Ingrid V." in the grid (column Tirsdag, row Dagskift).
2. In the box on the right, click "Flytt eller bytt".

You should see:

- An orange box appears: "Velg en ledig plass å flytte til ...".
- Free places now say "Flytt hit", and filled places say "Bytt med ...".

- [ ] It matched

### 2.9 ...finish the move, then undo it

Do this:

1. Continue from 2.8. Click a place that says "Flytt hit".
2. Then press Ctrl and Z at the same time.

You should see:

- First a green message "Ingrid V. er flyttet til ...".
- After Ctrl+Z, Ingrid V. is back on Tirsdag.

- [ ] It matched

### 2.10 Swap two people

Press F5 first, to start from the beginning.

Do this:

1. Click "Even M." (column Mandag, row Dagskift, the Skiftleder place).
2. Click "Flytt eller bytt".
3. Click "Bytt med Jonas" (column Tirsdag, row Dagskift, the Skiftleder place).

You should see:

- A green message: "Even M. og Jonas L. har byttet plass."
- Even M. is now on Tirsdag and Jonas L. on Mandag.

- [ ] It matched

### 2.11 Drag and drop

Press F5 first, to start from the beginning.

Do this:

1. Click "Uten skift" in the box on the right.
2. Press and hold the mouse button on "Emil T.", drag him onto a free Skjenker place in the column Torsdag, and let go.

You should see:

- A green message says Emil T. is placed.
- Also try: drag a person who is already in the grid onto a free place (they move), or onto another person (they swap).

- [ ] It matched

### 2.12 See who can work on one day

Press F5 first, to start from the beginning.

Do this:

1. Click the word "Mandag" at the top of the grid.

You should see:

- The Mandag header turns orange.
- The box on the right says "Sortert etter svar for mandag 30. november" and each person shows their answer for that day.
- Click "Fjern dag" to go back.

- [ ] It matched

### 2.13 The round buttons with numbers

Press F5 first, to start from the beginning.

Do this:

1. Click "! 1 problem". Then click the X in the box on the right.
2. Click "12 ledige". Then click the X.
3. Click "4 uten skift".

You should see:

- "! 1 problem" opens Kari B.'s place in the box on the right.
- "12 ledige" opens the first free place.
- "4 uten skift" selects a person (their row turns orange).

- [ ] It matched

### 2.14 Publish the week

Press F5 first, to start from the beginning.

Do this:

1. Click the red button "Publiser uka".

You should see:

- The label next to "Uke 49" changes to "Publisert" (green).
- The round week button shows "49 ✓".
- The red button changes to "Gjør til utkast".

- [ ] It matched

### 2.15 ...then change something

Do this:

1. Continue from 2.14. Put Emil T. on a place, as in 2.2 and 2.3.

You should see:

- The label changes to "Endret etter publisering" (yellow).

- [ ] It matched

### 2.16 Another bar and other weeks

Press F5 first, to start from the beginning.

Do this:

1. Click "Grøndahls" at the very top.
2. Click the arrow > to the right of the round week buttons.
3. Click the round button "49".

You should see:

- Grøndahls has one row called Pub, and Lørdag (Saturday) has places too.
- The arrow shows "Uke 50".
- "49" takes you back to "Uke 49".

- [ ] It matched

### 2.17 Search and filters

Press F5 first, to start from the beginning.

Do this:

1. Click in the box "Søk etter navn" and type: ada
2. Delete what you typed.
3. Click the round button "Skiftledere".

You should see:

- While "ada" is typed, only "Ada B." is in the list.
- With "Skiftledere", the list shows 5 people and the text "Viser 5 av 16".

- [ ] It matched

### 2.18 Someone is sick

Press F5 first, to start from the beginning.

Do this:

1. Find the column Mandag, row Dagskift, the Skjenker place. It has a red dashed border and says "Sara H." and "Kan ikke i dag, trenger erstatter". Click it.
2. Click any name in the box on the right.

You should see:

- In the grid, before you click: you can see at once that Sara H. had this shift but cannot come, and that the place needs someone else.
- Before you pick: the box on the right says "Sara H. har meldt kan ikke i dag. Den du velger tar plassen, og Sara H. tas av."
- After you pick: the person you chose is on the place, and the red note about Sara H. is gone.

- [ ] It matched

## Part 3: Try it without a mouse

Some leaders use only the keyboard. Put the mouse aside for these tests.

Keys you need: Tab moves to the next thing, Shift and Tab together move back, Enter presses the thing you are on, Esc steps back.

It is normal to press Tab many times: the grid has many places.

### 3.1 You can always see where you are

Press F5 first, to start from the beginning.

Do this:

1. Press Tab once, then keep pressing Tab slowly.

You should see:

- After the first Tab, a box "Gå til folk" appears at the top left.
- As you keep pressing Tab, a thick coloured frame always shows which button or place you are on.
- If the frame ever disappears or you cannot tell where you are, write down where it happened.

- [ ] It matched

### 3.2 Place a person with the keyboard

Press F5 first, to start from the beginning.

Do this:

1. Press Tab until you reach the round button "Uten skift" in the box on the right, and press Enter.
2. Press Tab until you reach "Emil T.", and press Enter.
3. Press Shift and Tab together (going backwards) until you reach a place in the grid that says "Sett inn Emil", and press Enter.

You should see:

- The green message says Emil T. is placed.
- The coloured frame is now on the place where Emil was put.

- [ ] It matched

### 3.3 Undo with the keyboard

Do this:

1. Continue from 3.2. Press Ctrl and Z at the same time.

You should see:

- The message says Emil T. is taken off again.

- [ ] It matched

### 3.4 Open and close a place

Press F5 first, to start from the beginning.

Do this:

1. Press Tab until you are on any place in the grid that says Ledig, and press Enter.
2. Press Esc.

You should see:

- After Enter: the box on the right shows that place.
- After Esc: the box goes back to the list of people, and the coloured frame is back on the same place in the grid.

- [ ] It matched

## Part 4: Small screens, zoom and printing

### 4.1 A narrow window

Press F5 first, to start from the beginning.

Do this:

1. If Chrome fills the whole screen, click the middle square button at the top right of the window so it gets smaller.
2. Drag the right edge of the Chrome window to the left until the window is about as narrow as a phone.

You should see:

- The box "Folk denne uka" moves down below the grid.
- The grid can be scrolled sideways inside its own frame, but the page itself does not move sideways.
- Nothing is cut off so you cannot read it.

- [ ] It matched

### 4.2 Zoom to 200%

Press F5 first, to start from the beginning.

Do this:

1. Make the window normal size again.
2. Hold Ctrl and press + several times, until the address bar shows 200%.
3. When you are done, press Ctrl and 0 (zero) to go back to normal.

You should see:

- Everything is bigger and still readable. Nothing overlaps or is cut off.

- [ ] It matched

### 4.3 Print

Press F5 first, to start from the beginning.

Do this:

1. Press Ctrl and P at the same time. A print preview opens.
2. Look at the preview, then click Cancel. (You do not need to print.)

You should see:

- The preview shows the title and the grid with names.
- It does not show the buttons or the box on the right.
- All seven days fit on the paper, Mandag to Søndag, and the paper is turned sideways (landscape).

- [ ] It matched

## Part 5 (optional): Listen with a screen reader

Blind and partially sighted people use a screen reader, a program that reads the screen aloud. This part takes extra time. Skip it if you do not have time or headphones.

### 5.1 Install and start NVDA

Do this:

1. In Chrome, open the address nvaccess.org/download and download NVDA (it is free). Install it.
2. Start NVDA by pressing Ctrl, Alt and N at the same time. It starts talking.
3. To stop NVDA later: press Insert and Q at the same time, then Enter.

You should see:

- NVDA says something when it starts.

- [ ] It matched

### 5.2 Listen to the grid

Press F5 first, to start from the beginning.

Do this:

1. Go to the Skiftlista page and press F5.
2. Press Tab until you are on a place in the grid, and listen.

You should see:

- It reads the role, the day with the full month, the shift, the person and any problem, something like: "Skiftleder mandag 30. november, Dagskift. Even M. svar: vil. Problem: 3 skift denne uka".
- If the voice sounds strange or English, NVDA is reading Norwegian text with an English voice. See 5.4.

- [ ] It matched

### 5.3 Hear the result of an action

Do this:

1. Do test 3.2 again (place Emil with the keyboard) while NVDA is running.

You should see:

- NVDA reads the green message by itself, without you moving to it.

- [ ] It matched

### 5.4 (If needed) Use a Norwegian voice

Do this:

1. First add a Norwegian voice to Windows: open Settings, then Time & language, then Speech. Under Manage voices, click Add voices, choose Norsk (bokmål), and click Add. Wait until it is installed.
2. Then in NVDA: press Insert and N together, choose Preferences, then Settings, then Speech. Next to Synthesizer, click Change and choose Windows OneCore voices. Click OK.
3. Next to Voice, choose the Norwegian voice (for example Microsoft Jon). Click OK.

You should see:

- Do 5.2 again. The Norwegian words now sound natural.

- [ ] It matched

## Part 6: Tell us what you found

For each problem, write down four things:

1. Which test (for example 2.8).

2. What you did.

3. What you expected to see.

4. What you saw instead.

A picture helps a lot: press the Windows key, Shift and S together, drag a box around the problem, and paste it (Ctrl and V) into your message.

Things that are not finished yet, so you do not need to report them:

- There is no real login. The page always says "Demo-leder".
- Nothing is saved. Reloading the page (F5) starts over.
- The button "Lag forslag for uka" is grey on purpose. Suggestions come later.
- The text about "Vis andre" in the box on the right is a placeholder for something that comes later.
- On a phone, the box on the right is shown below the grid. A special phone layout comes later.

## For developers (optional): the automatic checks

These run the same checks the computer runs on its own. Run them in the Ubuntu window, one command at a time. Stop the page first (Ctrl and C) or use a second Ubuntu window.

Go to the project folder:

    cd ~/kvarteret/samfunnetibergen

Check the code for mistakes:

    npm run typecheck:skiftlista

You should see: The last line says 0 ERRORS 0 WARNINGS.

Run the small tests:

    npm run test:skiftlista

You should see: It says Tests 11 passed (11).

Go to the app folder:

    cd apps/skiftlista

Tell the test browser where its extra files are (needed on this computer):

    export LD_LIBRARY_PATH=~/.cache/ms-playwright/syslibs/root/usr/lib/x86_64-linux-gnu

Run the browser tests (they click through the page by themselves, about 15 seconds):

    npx playwright test

You should see: It ends with 16 passed.
