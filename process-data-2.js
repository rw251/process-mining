const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Stream = require('stream');

console.time('Elapsed');

const sortedProcessedFile = fs.createReadStream(path.join(__dirname, 'data','processed-events.sorted.txt'));

const outputStream = fs.createWriteStream(path.join(__dirname, 'data', 'processed-events.sorted.processed.txt'));
const readable = new Stream.Readable({
  read(size) {
    return !!size;
  },
});

readable.pipe(outputStream);

outputStream.on('finish', () => {
  console.timeEnd('Elapsed');
});

let currentPatientId = -1;
let meds = {};
let phases = [[]];
let patientPhase = 0;
let events = [];
let hasHadMedsYet = false;

const merge = () => phases.map((phase,phaseId) => phase
      .concat(events)
      .sort((a,b) => {
        if(a.date > b.date) return 1;
        if(a.date < b.date) return -1;
        return 0;
      })
      .map((item) => {
        return `${item.patientId}_${phaseId}\t${item.date}\t${item.event}`;
      })
      .join('\n')
  ).join('\n') + '\n';

const onSortedLine = (line) => {
  const [ patientId, date, event ] = line.split('\t');
  
  if(patientId !== currentPatientId) {
	  // new patient
	  readable.push(merge());
	  
	  currentPatientId = patientId;
    phases = [[]];
    patientPhase = 0;
    meds = {};
    events = [];
    hasHadMedsYet = false;
  } 
  
  if(event.indexOf('STARTED') > -1) {
    meds[event.split(' ')[0]] = 1;
    hasHadMedsYet = true;
    phases[patientPhase].push({patientId, date, event});
  } else if (event.indexOf('STOPPED') > -1) {
    delete meds[event.split(' ')[0]]
    phases[patientPhase].push({patientId, date, event});
  } else {
    events.push({patientId, date, event})
  }

  if(hasHadMedsYet && Object.keys(meds).length===0) {
    // has had meds but none now, so end the phase
    patientPhase += 1;
    phases.push([]);
    hasHadMedsYet = false;
  }

};

const onSortedEnd = () => {
  console.log(`Sorteds loaded`);
  // write final patient TODO
  readable.push(merge());
};


const rlSorteds = readline.createInterface({
  input: sortedProcessedFile,
});
rlSorteds
  .on('line', onSortedLine)
  .on('close', onSortedEnd);
