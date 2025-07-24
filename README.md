# Logic Masters Germany Puzzle Watcher
Tampermonkey script to watch for new puzzles of a list of favourite setters

The script helps to check if one of your favourite setters has published a new puzzle on [Logic Masters Germany](https://logic-masters.de). 

## Installation
* Get the  tampermonkey add-in for your favourite browser
* Install the script in tampermonkey
* You should now see an additional widget on the left-hand side of the webpage underneath your user information.

## Usage
1. Figure out the internal username of your setter. The username is displayed at the heading of the user page, and it is also part of the URL when you are on the page of this user.
2. Enter (copy-paste) this username in the text box and click on the "add user" button.
3. The script now checks the ***first** page of puzzles by this user* and displays all unsolved puzzles.
4. Just click on the puzzle name to jump to a specific puzzle
5. You can click on a user name to jump to the first page of published puzzles of this user.
6. If you want to remove a user from your list, click on the "remove" button next to the user

## Remarks
Checking just the first page of puzzles is intentional to reduce server load, speed up the script, and avoid very long result lists. 
My assumption is that if you want to do all the puzzles of a specific user, you were working through the remaining pages in the past, so there is no real need to check for the other pages. 

The script reloads the data in an hourly interval to reduce server load. If you want to reload earlier, e.g. because you solved a puzzle and now want to clean up your list, you can click the "reload" button.
