const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Stream = require('stream');

console.time('Elapsed');

let done = 0;

const drugFile = fs.createReadStream(path.join(__dirname, 'data','input2.txt.done.sorted.processed'));
const otherFile = fs.createReadStream(path.join(__dirname, 'data','other_events2.txt'));

const outputStream = fs.createWriteStream(path.join(__dirname, 'data', 'processed-events.txt'));
const readable = new Stream.Readable({
  read(size) {
    return !!size;
  },
});

readable.pipe(outputStream);
readable.push('PATIENT\tTIME\tEVENT\n')

outputStream.on('finish', () => {
  console.timeEnd('Elapsed');
});

const areWeDone = () => {
  done += 1;
  if (done === 2) {
    readable.push(null);
    console.log('All files loaded.');
  }
};

const onDrugLine = (line) => {
  const elems = line.split('\t');

  let item = elems[2] === 'ASPIRIN' ? 'ASPIRIN' : elems[3];
  let event = `${item} ${elems[5]}`;
  if(elems[5]==='RESTARTED') {
    // for now don't care about this - just care that a drug was started
    event = `${item} STARTED`;
  } else if(elems[5]!=='STOPPED' && elems[5]!=='STARTED') {
    // don't care about dose increase/decrease events
    return;
  }

  const patid = elems[0];

  // shift events to certain times to ensure simultaneous events always have a default direction
  let date = elems[3] === 'NSAID' ? elems[1].substr(0,10) + ' 05:00:00' : elems[1];
  date = elems[3] === 'ANTIPLATELET' ? elems[1].substr(0,10) + ' 07:00:00' : date;
  date = elems[2] === 'ASPIRIN' ? elems[1].substr(0,10) + ' 06:00:00' : date;
  date = elems[3] === 'WARFARIN' ? elems[1].substr(0,10) + ' 08:00:00' : date;
  date = elems[3] === 'NOAC' ? elems[1].substr(0,10) + ' 09:00:00' : date;
  date = elems[3] === 'GASTRO_PROT' ? elems[1].substr(0,10) + ' 10:00:00' : date;

  const newline = `${patid}\t${date}\t${event}\n`;
  readable.push(newline);
};

const onDrugEnd = () => {
  console.log(`Drugs loaded`);
  areWeDone();
};

const onOtherLine = (line) => {
  const elems = line.split('\t');

  const event = elems[2];
  const patid = elems[0];

  // shift events to certain times to ensure simultaneous events always have a default direction
  let date = event === 'TURNED 65' ? elems[1].substr(0,10) + ' 02:00:00' : elems[1];
  date = event === 'BLEED EVENT' ? elems[1].substr(0,10) + ' 01:00:00' : date;
  date = event === 'CKD' ? elems[1].substr(0,10) + ' 03:00:00' : date;
  date = event === 'HEART FAILURE' ? elems[1].substr(0,10) + ' 04:00:00' : date;
  date = event === 'DIED' ? elems[1].substr(0,10) + ' 11:00:00' : date;

  const newline = `${patid}\t${date}\t${event}\n`;
  readable.push(newline);
};

const onOtherEnd = () => {
  console.log(`Other loaded`);
  areWeDone();
};

const rlDrugs = readline.createInterface({
  input: drugFile,
});
rlDrugs
  .on('line', onDrugLine)
  .on('close', onDrugEnd);

const rlOther = readline.createInterface({
  input: otherFile,
});
rlOther
  .on('line', onOtherLine)
  .on('close', onOtherEnd);