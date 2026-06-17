import {
  COUNTERBALANCE_CELLS,
  buildCounterbalancedAssignment,
} from "../functions/api/_counterbalance.js";

const lists = "ABCDEFGHIJ".split("");
const materials = [];

for (const stimulusList of lists) {
  for (let wordNumber = 1; wordNumber <= 50; wordNumber += 1) {
    materials.push({
      audio_url: `ame/${stimulusList}/${wordNumber}.wav`,
      target_word: `word${wordNumber}`,
      participant_id: "AME_S01",
      l1_condition: "AME",
      pronunciation_condition: "accented",
      stimulus_list: stimulusList,
      word_number: String(wordNumber),
      file_name: `ame_${stimulusList}_${wordNumber}.wav`,
    });

    for (const pronunciation of ["natural", "accented"]) {
      materials.push({
        audio_url: `jpn/${pronunciation}/${stimulusList}/${wordNumber}.wav`,
        target_word: `word${wordNumber}`,
        participant_id: "JPN_S01",
        l1_condition: "JPN",
        pronunciation_condition: pronunciation,
        stimulus_list: stimulusList,
        word_number: String(wordNumber),
        file_name: `jpn_${pronunciation}_${stimulusList}_${wordNumber}.wav`,
      });
      materials.push({
        audio_url: `chn/${pronunciation}/${stimulusList}/${wordNumber}.wav`,
        target_word: `word${wordNumber}`,
        participant_id: "CHN_S01",
        l1_condition: "CHN",
        pronunciation_condition: pronunciation,
        stimulus_list: stimulusList,
        word_number: String(wordNumber),
        file_name: `chn_${pronunciation}_${stimulusList}_${wordNumber}.wav`,
      });
    }
  }
}

function assertNoLongConstrainedRun(assignment) {
  let previous = "";
  let runLength = 0;
  for (const item of assignment) {
    const l1 = item.l1_condition;
    runLength = l1 === previous ? runLength + 1 : 1;
    previous = l1;
    if ((l1 === "AME" || l1 === "JPN") && runLength >= 3) {
      throw new Error(`Found ${l1} run of ${runLength} at trial ${item.trial_index}.`);
    }
  }
}

for (const cell of COUNTERBALANCE_CELLS) {
  const assignment = buildCounterbalancedAssignment(materials, cell, "verify-seed");
  if (assignment.length !== 100) {
    throw new Error(`Cell ${cell.cell_id} generated ${assignment.length} trials, expected 100.`);
  }
  assertNoLongConstrainedRun(assignment);
  const counts = assignment.reduce((acc, item) => {
    acc[item.l1_condition] = (acc[item.l1_condition] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `cell ${cell.cell_id}: ${assignment.length} trials, ` +
      `AME=${counts.AME || 0}, JPN=${counts.JPN || 0}, CHN=${counts.CHN || 0}`,
  );
}

console.log("counterbalance verification ok");
