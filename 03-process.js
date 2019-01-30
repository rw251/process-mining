const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Stream = require('stream');
const stats = require("stats-lite")
const {table} = require('table');
const mdtable = require('markdown-table')

console.time('Elapsed');

let done = 0;

const drugFile = fs.createReadStream(path.join(__dirname, 'data','03','med-events.txt'));
const otherFile = fs.createReadStream(path.join(__dirname, 'data','03','other-events.txt'));

const outputStream = fs.createWriteStream(path.join(__dirname, 'data', '03','processed-events.txt'));
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
	let numberOfGps = 0;
	let numberOfAPs = 0;
	let currentPatientId = -1;
	let lastEvent = null;
	let lastEventDate = 0;
	const transitions = {};
	
	const isOnGastProt = () => numberOfGps > 0
	const isOnAp = () => numberOfAPs > 0

	log
		.sort((a,b) => {
			if(a.patid != b.patid) return a.patid - b.patid;
			return new Date(a.date) - new Date(b.date);
		})
		.forEach(({patid, date, item, action}) => {
			if(item === 'NSAID') return;
			 if(patid !== currentPatientId) {
				  // if died is first either an error
				  // or we don't want them
				  if(action==='DIED') return;
				  
				  currentPatientId = patid;
				  numberOfGps = 0;	
				  numberOfAPs = 0;
				  lastEventDate = 0;	
				  lastEvent = null;
				  
				  if(action==='BLEED') action='INITIAL BLEED';
			 }
			 // GPM specific
			if(item === 'GPM') {
			  if(action === 'STARTED') {
				  // if already on one then don't log event
				  if(isOnGastProt()) {
					numberOfGps += 1;
					  return;
				  }
					numberOfGps += 1;
					action = "Started"
			  } else if(action === 'STOPPED') {
				  numberOfGps -= 1;
				  // if still got drugs then don't log event
				  if(isOnGastProt()) return;
				  action = "Stopped"
			  }
			}

					// AP difference if already on GPM
			if(item === 'ANTIPLATELET'){
				if(action === 'STARTED') {
					if(isOnAp()) {
						numberOfAPs += 1;
						return;
					}
					numberOfAPs+=1;
					action = isOnGastProt() ? "(GPM)" : "(no GPM)";
				} else {
					numberOfAPs -= 1;
					if(isOnAp()) return;
					action = 'Stopped';
				}
				item = 'AP'
			} 
						
			let event = item ? `${item} ${action}` : action;
			
			if(event === 'BLEED') event = 'Bleed';
			if(event === 'DIED') event = 'Died';
			if(event === 'INITIAL BLEED') event = 'Initial Bleed';
			
			if(lastEvent) {
				if(!transitions[lastEvent]) transitions[lastEvent] = {};
				if(!transitions[lastEvent][event]) transitions[lastEvent][event] = {count:0, durations:[]};
				
				transitions[lastEvent][event].count += 1;
				transitions[lastEvent][event].durations.push(new Date(date) - new Date(lastEventDate));
			}
			lastEvent = event;
			lastEventDate = date;
			readable.push(`${patid}\t${date}\t${event}\n`);
		})
    readable.push(null);
    console.log('All files loaded.');
	const allEvents = ["Bleed","AP (no GPM)","AP (GPM)","AP Stopped","GPM Started","GPM Stopped","Died"];
	
	const output = [[' '].concat(allEvents)];
	const config = {
		columnDefault: {
			width: 10,
			wrapWord: true
		}
	};
	
	['Initial Bleed'].concat(allEvents).forEach((eF) => {
		if(!transitions[eF]) return;
		const row = [eF];
		allEvents.forEach((eT) => {
			if(!transitions[eF][eT]) row.push('0');
			else {
				const median = ((stats.median(transitions[eF][eT].durations) * 12) / (1000 * 60 * 60 * 24 * 365.24)).toFixed(0);
				const lQuartile = ((stats.percentile(transitions[eF][eT].durations, 0.25) * 12) / (1000 * 60 * 60 * 24 * 365.24)).toFixed(0);
				const uQuartile = ((stats.percentile(transitions[eF][eT].durations, 0.75) * 12) / (1000 * 60 * 60 * 24 * 365.24)).toFixed(0);
				row.push(`${median}[${lQuartile},${uQuartile}],(${transitions[eF][eT].count})`);
			}
		})
		output.push(row);
	});

	console.log(table(output, config));
	
	console.log(mdtable(output));
  }
};

const log = [];

const onDrugLine = (line) => {
  const elems = line.split('\t');

  let initialDate = elems[1];
  let drug = elems[2];
  let item = drug === 'ASPIRIN' ? 'ANTIPLATELET' : elems[3];
  let action = elems[5];
  
  if(elems[5]==='RESTARTED') {
    // for now don't care about this - just care that a drug was started
	action = 'STARTED';
  } else if(elems[5]!=='STOPPED' && elems[5]!=='STARTED') {
    // don't care about dose increase/decrease events
    return;
  }

  const patid = elems[0];
   
   // shift events to certain times to ensure simultaneous events always have a default direction
  let date = item === 'NSAID' ? initialDate.substr(0,10) + ' 05:00:00' : initialDate;
  date = item === 'ANTIPLATELET' ? initialDate.substr(0,10) + ' 07:00:00' : date;
  date = drug === 'ASPIRIN' ? initialDate.substr(0,10) + ' 06:00:00' : date;
  date = item === 'WARFARIN' ? initialDate.substr(0,10) + ' 08:00:00' : date;
  date = item === 'NOAC' ? initialDate.substr(0,10) + ' 09:00:00' : date;
  date = item === 'GASTRO_PROT' ? initialDate.substr(0,10) + ' 10:00:00' : date;
  
  // GPM specific
  if(item === 'GASTRO_PROT') item = 'GPM';  
 
  const newline = `${patid}\t${date}\t${item}\t${action}\n`;
  log.push({patid, date, item, action});
  //readable.push(newline);
};

const onDrugEnd = () => {
  console.log(`Drugs loaded`);
  areWeDone();
};

const onOtherLine = (line) => {
  const elems = line.split('\t');

  const action = elems[2];
  const patid = elems[0];

  // shift events to certain times to ensure simultaneous events always have a default direction
  let date = action === 'TURNED 65' ? elems[1].substr(0,10) + ' 02:00:00' : elems[1];
  date = action === 'BLEED' ? elems[1].substr(0,10) + ' 01:00:00' : date;
  date = action === 'CKD' ? elems[1].substr(0,10) + ' 03:00:00' : date;
  date = action === 'HEART FAILURE' ? elems[1].substr(0,10) + ' 04:00:00' : date;
  date = action === 'DIED' ? elems[1].substr(0,10) + ' 11:00:00' : date;

  //const newline = `${patid}\t${date}\t\t${event}\n`;
  log.push({patid, date, item: false, action});
  // readable.push(newline);
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