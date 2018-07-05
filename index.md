<style>
	html,body { font-family: sans-serif; }	
	body { width:976px; margin-left:auto; margin-right:auto; }	
	.a { width: 100%; border: thin #c0c0c0 solid; background-image: radial-gradient(black, white); min-height: 200px; }	
	* { clear: both; }
	* { box-sizing: border-box;} 	
	.two-column { float: left; width: 50%; box-sizing: border-box; padding: 10px; margin: 0; clear: none; }
</style>

# Process mining notes

## 1 Aspirin + Antiplatelet must have Gastro Protection medication

### 1.1 Method

- Extracted all prescriptions for aspirin, other antiplatelets (clopidogrel, ticagrelor, prasugrel), and gastro protective medication (H2 antagonists and proton pump inhibitors).
- Collapsed prescriptions into STARTED and STOPPED events based on dose, instruction and packet size (e.g. if given 30 pills and the instruction of "take 2 daily" then we assume the drug is stopped 15 days after initiation unless a subsequent prescription is found in the record.)
- Load data into Disco
- Filter to just those paths that start with "ASPIRIN-STARTED" or "ANTIPLATELET-STARTED" on the basis that patients who initiated a GP drug for a different reason aren't really following the same process
- We only have dates - the time always defaults to 4am. So to avoid concurrent events I have added 1 hour to every gasto-protection prescription as it makes sense to prescribe this after the antiplatelets. I then analysed the data twice: in *analysis A* I subtracted 1 hour from all aspirin prescriptions, and in *analysis B* I substracted 1 hour from all antiplatelet prescriptions.

### 1.2 Output

#### 1.2.1 Initial output process maps

<figure class="two-column">
<figcaption>Figure 1. Analysis A (aspirin before antiplatelet when concurrent)</figcaption>
<img class="a" src="https://rw251.github.io/process-mining/images/aspirin_before_ap.png" />
</figure>

<figure class="two-column">
<figcaption>Figure 2. Analysis B  (antiplatelet before aspirin when concurrent)</figcaption>
<img class="a" src="https://rw251.github.io/process-mining/images/ap_before_aspirin.png" />
</figure>

#### 1.2.1 Filter to pathways with both an "ASPIRIN-STARTED" event and an "ANTIPLATELET-STARTED" event

<figure class="two-column">
<figcaption>Figure 3. Analysis A</figcaption>
<img class="a" src="https://rw251.github.io/process-mining/images/aspirin_before_ap_both_mandatory.png" />
</figure>

<figure class="two-column">
<figcaption>Figure 4. Analysis B</figcaption>
<img class="a" src="https://rw251.github.io/process-mining/images/ap_before_aspirin_both_mandatory.png" />
</figure>

### 1.3. Thoughts and questions

- Figure 1 
	- Lots of people are starting a GP after aspirin. These people probably have some other reason why they need gasto-protection e.g. they're also on Warfarin or have a history of internal bleeds / ulcers. In fact our medication dashboard has all of the following groups of patients who should have a GP:
		- Age >65 + NSAID
		- Aspirin + Antiplatelet
		- History of bleeds + Antiplatelet (including aspirin) 
		- History of bleeds + NSAID
		- Warfarin + Antiplatelet (including aspirin)
	- ***Perhaps I should look at a combined pathway including NSAID, antiplatelets, aspirin, warfarin and bleed history which might help find the interactions in patients with multiple morbidities?***
- Figure 2
	- I find it a bit annoying that there is a path from the start to the end that just includes ASPIRIN-STOPPED. If I set the path inclusion to 100% then this disappears as it isn't valid (it always comes after ASPIRIN-STARTED). ***Is there a way to deal with this situation?***
- Figures x/y/z
	- These process maps have routes that don't terminate e.g. you get stuck in a loop and can't get to the "STOP" node. I guess this is ok and is just trying to prevent spaghetti, but ***is it possible within Disco (or a different tool) to say something like "only show the top 60% of paths but include all paths from the START node and to the END node"?***
		


