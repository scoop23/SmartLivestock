type Step = { element: string; title: string; description: string };
const step = (element: string, title: string, description: string): Step => ({ element, title, description });

const outputRecordsGuide = (name: string, quantity: string) => ({
  title: `Review ${name} records`,
  description: `Use this view to inspect your saved ${name} entries and the summaries calculated from them.`,
  steps: [
    step('[data-tour="production-records-period"]', "Choose the summary period", "Switch between all dates and a month when these controls are available. These controls affect the overview; the history list has its own search and filters."),
    step('[data-tour="production-history-controls"]', "Find an entry", "Search the notes, activity type, or livestock and choose a sort order. Clear filters if an expected entry is missing."),
    step('[data-tour="production-history-record"]', `Read a ${name} entry`, `Check the animal, event date, ${quantity}, and available notes. Select the entry to open its full details and available actions.`),
    step('[data-tour="production-history-pagination"]', "More entries", "Use the page controls to browse additional records or change the number shown on a page."),
  ],
});

export const farmerPageGuides = {
  milkRecords: outputRecordsGuide("milk", "quantity in liters and milking session"),
  meatRecords: outputRecordsGuide("meat", "yield in kilograms and recorded purpose"),
  eggRecords: outputRecordsGuide("egg collection", "number of individual eggs and collection session"),
  woolRecords: outputRecordsGuide("wool", "yield in kilograms"),
  breedingRecords: {
    title: "Review breeding and insemination records",
    description: "Track recorded breeding events and their pregnancy-check outcomes.",
    steps: [
      step('[data-tour="breeding-records-summary"]', "Breeding overview", "Review the recorded pregnancy and breeding totals. A breeding event alone does not confirm pregnancy."),
      step('[data-tour="breeding-records-search"]', "Search breeding history", "Search by the dam, sire tag, or technician."),
      step('[data-tour="breeding-status-filters"]', "Filter the outcome", "Choose pending check, pregnant, calved, or open to inspect those events. All restores the full list."),
      step('[data-tour="breeding-history-card"]', "Read an event", "Review the dam, breeding date, sire information, recorded status, and estimated gestation timeline."),
      step('[data-tour="breeding-record-actions"]', "Record an outcome", "Confirm pregnancy only when a check has established it. The available buttons record outcomes; inspect the event and supporting findings before using them."),
    ],
  },
  birthRecords: {
    title: "Review birthing records",
    description: "Follow recorded births, their review progress, and any linked offspring inventory.",
    steps: [
      step('[data-tour="birth-records-summary"]', "Birth overview", "These figures summarize recorded births, offspring sex, and available birth-weight measurements."),
      step('[data-tour="birth-history-record"]', "Read a birth entry", "Review the birth date, mother, offspring details, birth weight, and review status."),
      step('[data-tour="birth-record-progress"]', "View review progress", "Open View progress to inspect the record's review stages. Use Open official inventory when a linked offspring inventory record is available."),
      step('[data-tour="birth-record-resubmit"]', "Correct a returned entry", "A correction action appears when revision is allowed. Review the staff remarks, correct the entry, and check it before resubmitting."),
    ],
  },
  weightRecords: {
    title: "Review weight and growth records",
    description: "Inspect past weigh-ins and the growth figures calculated from recorded measurements.",
    steps: [
      step('[data-tour="weight-records-summary"]', "Weight overview", "Review the weight and growth summaries for the selected livestock. Calculations depend on the available measurements."),
      step('[data-tour="weight-records-filters"]', "Find a weigh-in", "Search by tag, species, breed, date, or notes. Use the animal filter and sort controls to narrow the history."),
      step('[data-tour="weight-records-table"]', "Read the measurements", "Each row shows recorded weight and date. Weight gain and average daily gain compare dated measurements; a missing value means there is not enough usable comparison data."),
    ],
  },
  feedingRecords: {
    title: "Review feeding and ration records",
    description: "Review what was fed, to which animal or herd, and the recorded feed quantities and expenses.",
    steps: [
      step('[data-tour="feeding-records-summary"]', "Recorded feed totals", "These totals summarize feed quantities and entered costs. Missing costs are not evidence that feed was free."),
      step('[data-tour="feeding-records-filters"]', "Find a ration entry", "Search animal tags, batch codes, or feed names, and use the category buttons to narrow the list."),
      step('[data-tour="feeding-history-record"]', "Read a feeding entry", "Check the recipient, feeding date, session, feed category, total kilograms, and any recorded cost or notes."),
      step('[data-tour="feeding-record-delete"]', "Remove an incorrect entry", "Check the recipient and date first. This action removes the entry and updates its recorded history and summaries."),
    ],
  },
  treatmentRecords: {
    title: "Review treatment records",
    description: "Review care already recorded for your animals, including medication details and follow-up dates.",
    steps: [
      step('[data-tour="treatment-records-summary"]', "Treatment overview", "Review counts of recorded treatments and follow-ups. These figures summarize entered records."),
      step('[data-tour="treatment-records-search"]', "Find a treatment", "Search by animal, medication, or reason to find a specific entry."),
      step('[data-tour="treatment-records-table"]', "Read the treatment history", "Check the animal, treatment date, product, recorded dosage and route, person administering it, and follow-up date. Refer to the actual veterinary instructions for care and withdrawal requirements."),
    ],
  },
  salesRecords: {
    title: "Review sales and intent records",
    description: "Review completed sales separately from plans to sell, slaughter, or move animals.",
    steps: [
      step('[aria-label="Cattle sales and market prices"]', "Sales or price reference", "Your sales records show your own history. Market prices provide comparison information and do not guarantee your selling price."),
      step('[data-tour="sales-history-panel"]', "Completed sales", "Review the animal, sale date, quantity, and recorded value. Official transfer certificates are available through ownership history."),
      step('[data-tour="sales-intent-panel"]', "Declared plans", "This section lists active sale, slaughter, or movement intentions. A declaration records a plan and does not establish a completed sale or movement."),
      step('[data-tour="sales-ownership-link"]', "Open ownership history", "Use this link to inspect the transfer certificates linked to your account."),
    ],
  },
  programs: {
    title: "Book livestock programs",
    description: "Browse programs from the agriculture office, choose an available appointment, and keep track of your bookings.",
    steps: [
      step('[data-tour="program-search"]', "Find a program", "Search the available programs to find the activity you need. Clear your search to see the full list again."),
      step('#available-programs-header', "Choose an appointment", "Review the program, date, location, and available slots. Select an available program to open its booking form; check the details before confirming."),
      step('#my-bookings-section [data-slot="card-header"]', "Manage your bookings", "Switch between upcoming and past bookings. Open a booking to review its details and attendance QR pass. Use the cancellation option when it is available."),
    ],
  },
  herds: {
    title: "Manage your herds and batches",
    description: "Herds group your animals so you can review their roster and growth together.",
    steps: [
      step('section[aria-label="Herd telemetry summary"]', "Herd overview", "These totals summarize your herds and the animals assigned to them. A herd groups animals; it does not add extra animals to your inventory."),
      step('section[aria-labelledby="herd-list-title"] input', "Find a herd", "Search the herd directory to find the group you want to inspect."),
      step('#herd-list-title', "Open a herd", "Select a herd to inspect its animal roster, photos, and recorded growth. Herd details provide the available membership and management actions."),
    ],
  },
  animals: {
    title: "Your livestock records",
    description: "Use this directory to find your animals and open their individual records.",
    steps: [
      step('[data-tour="records-controls"]', "Search and filter", "Search by ear tag, breed, or species. Use the available filters and sorting controls to narrow the list; clear them if an animal seems to be missing."),
      step('[data-tour="livestock-record-card"]', "Review an animal", "Check the animal's identity and approval status. Each card summarizes the information recorded for that animal."),
      step('[data-tour="record-card-actions"]', "View and manage", "Open the animal's details for its full record. Edit or delete actions appear only when allowed for that record."),
    ],
  },
  livestockHistory: {
    title: "Past livestock records",
    description: "Past records remain available after an animal is sold, deceased, slaughtered, or moved out.",
    steps: [
      step('[aria-label="Search livestock history"]', "Find a past animal", "Search by tag, livestock type, breed, or status."),
      step('[aria-label="Filter livestock history by status"]', "Choose a history status", "Filter the history by the animal's recorded outcome, or choose all statuses."),
      step('[data-tour="livestock-history-results"] > :first-child', "Review recorded history", "Open an available history entry to review the recorded details. An empty list can mean there are no past animals or that your filters match none."),
    ],
  },
  ownership: {
    title: "Ownership transfer history",
    description: "Review transfer certificates linked to your account and check the recorded seller, buyer, and review status.",
    steps: [
      step('[data-tour="ownership-history-list"] > :first-child', "Your transfer records", "Transfers appear here when they are linked to your account. If the list is empty, there are no linked transfers to display."),
      step('[data-tour="ownership-transfer-card"]', "Read a certificate", "Check the animal tag, previous and new owner, certificate numbers, transfer date, and location. The status shows the transfer's review progress."),
    ],
  },
  productionHistory: {
    title: "Review production history",
    description: "Find your submitted production records and open an entry to inspect its details.",
    steps: [
      step('[data-tour="production-history-controls"]', "Search and sort", "Search notes, activity type, or livestock. Use the available type and sorting controls to change which entries are shown."),
      step('[data-tour="production-history-record"]', "Open a record", "Select a production entry to inspect its recorded values and available actions. Check that the livestock and activity date match the entry you need."),
      step('[data-tour="production-history-back"]', "Return to activities", "Use this button to return to the activities or analytics page you came from."),
    ],
  },
  productionAnalytics: {
    title: "Understand your production analytics",
    description: "Explore summaries of your own farm records and any estimates supported by your historical data.",
    steps: [
      step('[data-tour="production-analytics-navigation"]', "Activities and history", "Return to recording activities or open History to review the individual entries behind the summaries."),
      step('[data-tour="production-analytics-domains"]', "Choose an activity", "Select a domain to explore the available production, breeding, or feeding summaries."),
      step('[data-tour="production-analytics-domain"]', "Read the selected view", "Review the period and units before comparing totals. Forecasts are estimates and require enough suitable records; missing information may make them unavailable."),
      step('[data-tour="production-analytics-results"]', "Read your results", "Charts and totals describe your recorded activities. Check the dates, units, and available history before comparing figures."),
      step('#cow-select', "Choose an animal for milk estimates", "Select a dairy animal to inspect its available milk forecast. The page explains when there is too little history to generate an estimate."),
    ],
  },
  productionActivity: {
    title: "Your livestock activity workspace",
    description: "Review the selected species and activity before recording or inspecting farm events.",
    steps: [
      step('[data-tour="activity-workspace"] h2', "Choose and review an activity", "Use the available activity controls to view records or open an entry form. Available activities depend on your livestock and its eligibility."),
      step('[aria-label="Horizontal scrollbar for production tabs"]', "More activity tabs", "If the activity tabs extend beyond the screen, scroll horizontally to see the remaining options."),
      step('#market-price-reference', "Market price reference", "Reference prices help you compare a possible sale. They do not confirm a buyer's offer or guarantee the final selling price."),
    ],
  },
  announcements: {
    title: "Announcements and farm programs",
    description: "Read updates from the agriculture office and check the details of programs available to farmers.",
    steps: [
      step('[data-tour="announcement-category"]', "Choose a category", "Filter the feed by announcement or program category. Return to All to see every available category."),
      step('[aria-label="Search activities"]', "Search updates", "Search bulletin or program titles. Clear the search when you want to browse the full feed."),
      step('[data-tour="announcement-item"]', "Read the full update", "Select an activity to review its full description, photos, dates, location, and any registration details provided."),
    ],
  },
  notifications: {
    title: "Your notifications",
    description: "Review livestock alerts, review decisions, and program updates sent to your account.",
    steps: [
      step('[data-tour="notification-controls"]', "Manage and filter notices", "Use the status filter to view all, read, or unread notices. Select individual notices before applying a bulk read or delete action."),
      step('[aria-label="Enable push notifications"], [aria-label="Disable push notifications"]', "Browser alerts", "Enable push notifications if supported and allow the browser permission when prompted. This controls browser alerts, not the records listed on this page."),
      step('[data-tour="notification-item"]', "Open a notice", "Read the message and use its available link to open the related record or activity. A notification describes an update; review the linked record for the full details."),
    ],
  },
  map: {
    title: "Explore your farm map",
    description: "Use the map to explore the livestock information available to your farmer account.",
    steps: [
      step('[data-tour="farmer-map-controls"]', "Map controls", "Use the available controls to choose a layer or view. Only the options permitted for your account are offered."),
      step('.leaflet-container, canvas', "Explore the map", "Pan and zoom to explore the map. Select an available barangay or marker to inspect the information shown for your account."),
      step('[data-tour="farmer-map-legend"]', "Read the legend", "The legend explains the current layer's colors and symbols. A report alert signals a need for follow-up; it is not a confirmed diagnosis."),
    ],
  },
} satisfies Record<string, { title: string; description: string; steps: Step[] }>;

export type FarmerPageGuide = keyof typeof farmerPageGuides;
