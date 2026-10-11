const KEY='nodspel.tutorial.seen';
export function tutorialNeeded(storage){try{return storage.getItem(KEY)!=='1';}catch{return true;}}
export function completeTutorial(storage){try{storage.setItem(KEY,'1');}catch{}}
