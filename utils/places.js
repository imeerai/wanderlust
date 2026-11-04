// Well-known Pakistani places, so most listing maps load instantly without any outside lookup.
const PLACES = {
  swat: [34.7717, 72.36], mingora: [34.7717, 72.36], kalam: [35.49, 72.58], "malam jabba": [34.8, 72.57],
  hunza: [36.3167, 74.65], karimabad: [36.3167, 74.65], skardu: [35.2971, 75.6333], gilgit: [35.9208, 74.3089],
  "fairy meadows": [35.385, 74.58], chitral: [35.8518, 71.7864],
  murree: [33.907, 73.3943], bhurban: [33.995, 73.467], ayubia: [34.07, 73.39], "nathia gali": [34.072, 73.379],
  naran: [34.9072, 73.6513], kaghan: [34.776, 73.52], shogran: [34.63, 73.48], neelum: [34.58, 73.85],
  muzaffarabad: [34.37, 73.4711], abbottabad: [34.1688, 73.2215],
  karachi: [24.8607, 67.0011], hyderabad: [25.396, 68.3578], gwadar: [25.1216, 62.3254],
  lahore: [31.5204, 74.3587], faisalabad: [31.4504, 73.135], multan: [30.1575, 71.5249],
  sialkot: [32.4945, 74.5229], bahawalpur: [29.3544, 71.6911],
  islamabad: [33.6844, 73.0479], rawalpindi: [33.5651, 73.0169], peshawar: [34.0151, 71.5249], quetta: [30.1798, 66.975],
};
const KEYS = Object.keys(PLACES).sort((a, b) => b.length - a.length);

function lookupPlace(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return null;
  const k = KEYS.find((name) => t.includes(name));
  return k ? { lat: PLACES[k][0], lng: PLACES[k][1] } : null;
}

module.exports = { lookupPlace, PAKISTAN: { lat: 30.3753, lng: 69.3451 } };
