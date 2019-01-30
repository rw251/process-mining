const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Stream = require('stream');

console.time('Elapsed');

let done = 0;

const drugFile = fs.createReadStream(path.join(__dirname, 'data','med-events.txt'));
const otherFile = fs.createReadStream(path.join(__dirname, 'data','other-events.txt'));

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

let currentPatientsMeds = {};
let currentPatientId = -1;

const isOnGastProt = date => Object.values(currentPatientsMeds).filter(val => val < date).length > 0

const onDrugLine = (line) => {
  const elems = line.split('\t');

  let initialDate = elems[1];
  let drug = elems[2];
  let item = drug === 'ASPIRIN' ? drug : elems[3];
  let action = elems[5];
  
  if(elems[5]==='RESTARTED') {
    // for now don't care about this - just care that a drug was started
	action = 'STARTED';
  } else if(elems[5]!=='STOPPED' && elems[5]!=='STARTED') {
    // don't care about dose increase/decrease events
    return;
  }

  const patid = elems[0];
  
  if(patid !== currentPatientId) {
	  currentPatientId = patid;
	  currentPatientsMeds = {};
  }
  
   // shift events to certain times to ensure simultaneous events always have a default direction
  let date = item === 'NSAID' ? initialDate.substr(0,10) + ' 05:00:00' : initialDate;
  date = item === 'ANTIPLATELET' ? initialDate.substr(0,10) + ' 07:00:00' : date;
  date = drug === 'ASPIRIN' ? initialDate.substr(0,10) + ' 06:00:00' : date;
  date = item === 'WARFARIN' ? initialDate.substr(0,10) + ' 08:00:00' : date;
  date = item === 'NOAC' ? initialDate.substr(0,10) + ' 09:00:00' : date;
  date = item === 'GASTRO_PROT' ? initialDate.substr(0,10) + ' 10:00:00' : date;
  
  // GP specific
  if(item === 'GASTRO_PROT') {
	  if(action === 'STARTED') {
		  // if already on one then don't log event
		  if(patid==="14017") console.log(drug, date, Object.keys(currentPatientsMeds).length)
		  if(isOnGastProt(date)) {
			currentPatientsMeds[drug] = date;
			  return;
		  }
		  currentPatientsMeds[drug] = true;
	  } else if(action === 'STOPPED') {
		  delete currentPatientsMeds[drug];
		  // if still got drugs then don't log event
		  if(isOnGastProt(date)) return;
	  }
	  item = 'GP';
  }
  
  // NSAID difference if already on GP
  if(item === 'NSAID' && action === 'STARTED') {
	action = isOnGastProt(date) ? "START (EXISTING GP)" : "START (NO EXISTING GP)";
  }
  
  const event = `${item} ${action}`;

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
  date = event === 'BLEED' ? elems[1].substr(0,10) + ' 01:00:00' : date;
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