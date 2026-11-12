// D3.1 / D3.2: the player meets BIT for the first time inside the bunker.
// The FTUE intro raid (`?ftue=1` from startFtueDirect) is the fight toward that
// meeting, so BIT does not accompany, heal, distract, or comment. The first
// ordinary raid after the greeting is the first one undertaken together (D3.7).
export function bitAccompaniesRaid(launch){
  return !launch?.ftue;
}
