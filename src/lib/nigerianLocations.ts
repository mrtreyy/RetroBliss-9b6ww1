
// Comprehensive Nigerian Locations Database
// All states, cities, landmarks, and famous places

export interface NigerianLocation {
  name: string;
  state: string;
  type: 'city' | 'area' | 'landmark' | 'market' | 'lga';
  lat: number;
  lng: number;
}

export const NIGERIAN_STATE_COORDS: Record<string, [number, number]> = {
  'Abia': [7.5248, 5.4527],
  'Adamawa': [12.3984, 9.3265],
  'Akwa Ibom': [7.8500, 5.0500],
  'Anambra': [6.7500, 6.5244],
  'Bauchi': [9.8442, 10.3104],
  'Bayelsa': [6.0699, 4.7719],
  'Benue': [8.7800, 7.7300],
  'Borno': [13.1919, 11.8333],
  'Cross River': [8.3300, 5.8700],
  'Delta': [5.7040, 5.8900],
  'Ebonyi': [8.0932, 6.2649],
  'Edo': [5.6037, 6.3350],
  'Ekiti': [5.2186, 7.7200],
  'Enugu': [7.5248, 6.4584],
  'FCT': [7.4898, 9.0579],
  'Gombe': [11.1670, 10.2897],
  'Imo': [7.0498, 5.4898],
  'Jigawa': [9.3590, 12.2288],
  'Kaduna': [7.4370, 10.5264],
  'Kano': [8.5120, 12.0022],
  'Katsina': [7.6063, 12.9908],
  'Kebbi': [4.1973, 12.4500],
  'Kogi': [6.7424, 7.8014],
  'Kwara': [4.5500, 8.4800],
  'Lagos': [3.3792, 6.5244],
  'Nasarawa': [8.5300, 8.5300],
  'Niger': [6.0500, 9.9300],
  'Ogun': [3.3500, 7.1600],
  'Ondo': [5.1900, 7.2500],
  'Osun': [4.5624, 7.5629],
  'Oyo': [3.9470, 7.3776],
  'Plateau': [8.8921, 9.2182],
  'Rivers': [7.0134, 4.8156],
  'Sokoto': [5.2320, 13.0059],
  'Taraba': [11.4500, 8.0000],
  'Yobe': [11.7465, 12.2940],
  'Zamfara': [6.2333, 12.1702],
};

export const NIGERIAN_LOCATIONS_BY_STATE: Record<string, NigerianLocation[]> = {
  'Lagos': [
    { name: 'Ikeja', state: 'Lagos', type: 'city', lat: 6.6018, lng: 3.3488 },
    { name: 'Victoria Island', state: 'Lagos', type: 'area', lat: 6.4314, lng: 3.4219 },
    { name: 'Lekki', state: 'Lagos', type: 'area', lat: 6.4478, lng: 3.5561 },
    { name: 'Lagos Island', state: 'Lagos', type: 'city', lat: 6.4550, lng: 3.4000 },
    { name: 'Surulere', state: 'Lagos', type: 'area', lat: 6.5057, lng: 3.3494 },
    { name: 'Yaba', state: 'Lagos', type: 'area', lat: 6.5159, lng: 3.3796 },
    { name: 'Ajah', state: 'Lagos', type: 'area', lat: 6.4649, lng: 3.5857 },
    { name: 'Apapa', state: 'Lagos', type: 'area', lat: 6.4490, lng: 3.3597 },
    { name: 'Ikorodu', state: 'Lagos', type: 'city', lat: 6.6194, lng: 3.5085 },
    { name: 'Mushin', state: 'Lagos', type: 'area', lat: 6.5369, lng: 3.3584 },
    { name: 'Oshodi', state: 'Lagos', type: 'area', lat: 6.5565, lng: 3.3327 },
    { name: 'Agege', state: 'Lagos', type: 'area', lat: 6.6200, lng: 3.3200 },
    { name: 'Alimosho', state: 'Lagos', type: 'lga', lat: 6.6170, lng: 3.2577 },
    { name: 'Badagry', state: 'Lagos', type: 'city', lat: 6.4230, lng: 2.8827 },
    { name: 'Epe', state: 'Lagos', type: 'city', lat: 6.5854, lng: 3.9835 },
    { name: 'Maryland', state: 'Lagos', type: 'area', lat: 6.5710, lng: 3.3760 },
    { name: 'Gbagada', state: 'Lagos', type: 'area', lat: 6.5513, lng: 3.3822 },
    { name: 'Palmgrove', state: 'Lagos', type: 'area', lat: 6.5600, lng: 3.3700 },
    { name: 'Ketu', state: 'Lagos', type: 'area', lat: 6.5940, lng: 3.3906 },
    { name: 'Mile 12', state: 'Lagos', type: 'area', lat: 6.6050, lng: 3.3900 },
    { name: 'Ojota', state: 'Lagos', type: 'area', lat: 6.5860, lng: 3.3840 },
    { name: 'Isale Eko', state: 'Lagos', type: 'area', lat: 6.4560, lng: 3.3940 },
    { name: 'Obalende', state: 'Lagos', type: 'area', lat: 6.4525, lng: 3.4216 },
    { name: 'Bar Beach', state: 'Lagos', type: 'landmark', lat: 6.4270, lng: 3.4310 },
    { name: 'Eko Hotel', state: 'Lagos', type: 'landmark', lat: 6.4310, lng: 3.4220 },
    { name: 'National Theatre', state: 'Lagos', type: 'landmark', lat: 6.4610, lng: 3.3760 },
    { name: 'Lagos Airport', state: 'Lagos', type: 'landmark', lat: 6.5773, lng: 3.3215 },
    { name: 'Balogun Market', state: 'Lagos', type: 'market', lat: 6.4530, lng: 3.3910 },
    { name: 'Computer Village', state: 'Lagos', type: 'landmark', lat: 6.6040, lng: 3.3510 },
    { name: 'Sangotedo', state: 'Lagos', type: 'area', lat: 6.4360, lng: 3.5660 },
    { name: 'Chevron', state: 'Lagos', type: 'area', lat: 6.4310, lng: 3.5070 },
    { name: 'Osapa London', state: 'Lagos', type: 'area', lat: 6.4370, lng: 3.4920 },
    { name: 'Jakande', state: 'Lagos', type: 'area', lat: 6.4430, lng: 3.5220 },
    { name: 'Abraham Adesanya', state: 'Lagos', type: 'area', lat: 6.4520, lng: 3.5740 },
    { name: 'Ibeju Lekki', state: 'Lagos', type: 'area', lat: 6.5000, lng: 3.7500 },
    { name: 'Eti Osa', state: 'Lagos', type: 'lga', lat: 6.4500, lng: 3.5500 },
    { name: 'Allen Avenue', state: 'Lagos', type: 'area', lat: 6.6028, lng: 3.3525 },
    { name: 'Toyin Street', state: 'Lagos', type: 'area', lat: 6.6010, lng: 3.3490 },
    { name: 'Mende', state: 'Lagos', type: 'area', lat: 6.5550, lng: 3.3780 },
    { name: 'Ojuelegba', state: 'Lagos', type: 'area', lat: 6.5050, lng: 3.3650 },
    { name: 'Ogba', state: 'Lagos', type: 'area', lat: 6.6100, lng: 3.3300 },
    { name: 'Alausa', state: 'Lagos', type: 'area', lat: 6.6072, lng: 3.3490 },
    { name: 'Oregun', state: 'Lagos', type: 'area', lat: 6.6160, lng: 3.3600 },
    { name: 'Ojodu Berger', state: 'Lagos', type: 'area', lat: 6.6350, lng: 3.3450 },
    { name: 'Magodo', state: 'Lagos', type: 'area', lat: 6.5960, lng: 3.3890 },
    { name: 'Isheri', state: 'Lagos', type: 'area', lat: 6.6280, lng: 3.3570 },
    { name: 'Ilupeju', state: 'Lagos', type: 'area', lat: 6.5680, lng: 3.3640 },
    { name: 'Igbobi', state: 'Lagos', type: 'area', lat: 6.5300, lng: 3.3720 },
    { name: 'Kosofe', state: 'Lagos', type: 'lga', lat: 6.5700, lng: 3.4100 },
    { name: 'Shangisha', state: 'Lagos', type: 'area', lat: 6.6300, lng: 3.4000 },
    { name: 'Agbara', state: 'Lagos', type: 'area', lat: 6.5117, lng: 3.0913 },
    { name: 'Festac', state: 'Lagos', type: 'area', lat: 6.4688, lng: 3.2777 },
    { name: 'Satellite Town', state: 'Lagos', type: 'area', lat: 6.4620, lng: 3.2650 },
    { name: 'Amuwo Odofin', state: 'Lagos', type: 'lga', lat: 6.4800, lng: 3.2900 },
    { name: 'Bolade Oshodi', state: 'Lagos', type: 'area', lat: 6.5540, lng: 3.3350 },
    { name: 'Oworonsoki', state: 'Lagos', type: 'area', lat: 6.5380, lng: 3.4050 },
    { name: 'Anthony Village', state: 'Lagos', type: 'area', lat: 6.5620, lng: 3.3800 },
    { name: 'Onipanu', state: 'Lagos', type: 'area', lat: 6.5520, lng: 3.3790 },
    { name: 'Iwaya', state: 'Lagos', type: 'area', lat: 6.5230, lng: 3.3780 },
    { name: 'Makoko', state: 'Lagos', type: 'area', lat: 6.5050, lng: 3.3930 },
    { name: 'Akoka', state: 'Lagos', type: 'area', lat: 6.5177, lng: 3.3844 },
    { name: 'University of Lagos', state: 'Lagos', type: 'landmark', lat: 6.5158, lng: 3.3978 },
    { name: 'Lagos State Secretariat', state: 'Lagos', type: 'landmark', lat: 6.6070, lng: 3.3490 },
    { name: 'LASUTH Hospital', state: 'Lagos', type: 'landmark', lat: 6.6000, lng: 3.3490 },
    { name: 'Murtala Muhammed Airport', state: 'Lagos', type: 'landmark', lat: 6.5773, lng: 3.3215 },
    { name: 'Ojota Bus Stop', state: 'Lagos', type: 'landmark', lat: 6.5862, lng: 3.3828 },
    { name: 'Lekki Toll Gate', state: 'Lagos', type: 'landmark', lat: 6.4441, lng: 3.5313 },
    { name: '1004 Housing Estate', state: 'Lagos', type: 'landmark', lat: 6.4330, lng: 3.4100 },
    { name: 'Admiralty Way', state: 'Lagos', type: 'area', lat: 6.4290, lng: 3.4540 },
    { name: 'Oniru', state: 'Lagos', type: 'area', lat: 6.4340, lng: 3.4630 },
    { name: 'Elegushi Beach', state: 'Lagos', type: 'landmark', lat: 6.4370, lng: 3.4800 },
    { name: 'Ikate Elegushi', state: 'Lagos', type: 'area', lat: 6.4360, lng: 3.4780 },
    { name: 'Maroko', state: 'Lagos', type: 'area', lat: 6.4310, lng: 3.5020 },
    { name: 'Ilasan', state: 'Lagos', type: 'area', lat: 6.4520, lng: 3.5330 },
    { name: 'Agungi', state: 'Lagos', type: 'area', lat: 6.4380, lng: 3.5120 },
    { name: 'Igbo Efon', state: 'Lagos', type: 'area', lat: 6.4330, lng: 3.5490 },
    { name: 'Idado', state: 'Lagos', type: 'area', lat: 6.4380, lng: 3.4910 },
    { name: 'Oral Estate', state: 'Lagos', type: 'area', lat: 6.4350, lng: 3.4960 },
    { name: 'Orchid Hotel Road', state: 'Lagos', type: 'area', lat: 6.4180, lng: 3.5730 },
    { name: 'Pinnock Beach Estate', state: 'Lagos', type: 'area', lat: 6.4230, lng: 3.5590 },
    { name: 'Thomas Estate', state: 'Lagos', type: 'area', lat: 6.4550, lng: 3.5870 },
    { name: 'Eleko Junction', state: 'Lagos', type: 'area', lat: 6.4920, lng: 3.6530 },
    { name: 'Langbasa', state: 'Lagos', type: 'area', lat: 6.4640, lng: 3.5930 },
  ],

  'Abuja': [
    { name: 'Maitama', state: 'Abuja', type: 'area', lat: 9.0781, lng: 7.5053 },
    { name: 'Wuse II', state: 'Abuja', type: 'area', lat: 9.0722, lng: 7.4697 },
    { name: 'Garki', state: 'Abuja', type: 'area', lat: 9.0424, lng: 7.4842 },
    { name: 'Asokoro', state: 'Abuja', type: 'area', lat: 9.0429, lng: 7.5234 },
    { name: 'Gudu', state: 'Abuja', type: 'area', lat: 8.9820, lng: 7.4380 },
    { name: 'Jabi', state: 'Abuja', type: 'area', lat: 9.0671, lng: 7.4369 },
    { name: 'Kubwa', state: 'Abuja', type: 'city', lat: 9.1488, lng: 7.3153 },
    { name: 'Gwagwalada', state: 'Abuja', type: 'city', lat: 8.9417, lng: 7.0853 },
    { name: 'Area 1', state: 'Abuja', type: 'area', lat: 9.0226, lng: 7.4878 },
    { name: 'Area 11', state: 'Abuja', type: 'area', lat: 9.0460, lng: 7.4620 },
    { name: 'Gwarinpa', state: 'Abuja', type: 'area', lat: 9.1112, lng: 7.3974 },
    { name: 'Lugbe', state: 'Abuja', type: 'area', lat: 8.9940, lng: 7.4000 },
    { name: 'Karu', state: 'Abuja', type: 'area', lat: 9.0378, lng: 7.5738 },
    { name: 'Nyanya', state: 'Abuja', type: 'area', lat: 9.0194, lng: 7.5499 },
    { name: 'Dutse', state: 'Abuja', type: 'area', lat: 9.1160, lng: 7.3630 },
    { name: 'Utako', state: 'Abuja', type: 'area', lat: 9.0650, lng: 7.4480 },
    { name: 'Wuse', state: 'Abuja', type: 'area', lat: 9.0606, lng: 7.4700 },
    { name: 'Central Area', state: 'Abuja', type: 'area', lat: 9.0565, lng: 7.4890 },
    { name: 'Aso Rock', state: 'Abuja', type: 'landmark', lat: 9.0570, lng: 7.5145 },
    { name: 'Abuja Airport', state: 'Abuja', type: 'landmark', lat: 9.0067, lng: 7.2631 },
    { name: 'National Assembly', state: 'Abuja', type: 'landmark', lat: 9.0660, lng: 7.5070 },
    { name: 'Abuja Mall', state: 'Abuja', type: 'landmark', lat: 9.0680, lng: 7.4340 },
    { name: 'Transcorp Hilton', state: 'Abuja', type: 'landmark', lat: 9.0680, lng: 7.4892 },
    { name: 'Berger Roundabout', state: 'Abuja', type: 'landmark', lat: 9.0440, lng: 7.4730 },
    { name: 'Bwari', state: 'Abuja', type: 'city', lat: 9.2500, lng: 7.3800 },
    { name: 'Abaji', state: 'Abuja', type: 'city', lat: 8.4681, lng: 6.9404 },
    { name: 'Mpape', state: 'Abuja', type: 'area', lat: 9.1100, lng: 7.4500 },
    { name: 'Lokogoma', state: 'Abuja', type: 'area', lat: 8.9980, lng: 7.4200 },
    { name: 'Apo', state: 'Abuja', type: 'area', lat: 9.0130, lng: 7.5180 },
    { name: 'Wuye', state: 'Abuja', type: 'area', lat: 9.0840, lng: 7.4410 },
    { name: 'Katampe', state: 'Abuja', type: 'area', lat: 9.1100, lng: 7.4270 },
    { name: 'Life Camp', state: 'Abuja', type: 'area', lat: 9.0980, lng: 7.4080 },
    { name: 'Galadimawa', state: 'Abuja', type: 'area', lat: 9.0170, lng: 7.4390 },
    { name: 'Kuje', state: 'Abuja', type: 'city', lat: 8.8816, lng: 7.2302 },
  ],

  'Rivers': [
    { name: 'Port Harcourt City', state: 'Rivers', type: 'city', lat: 4.8156, lng: 7.0134 },
    { name: 'GRA Port Harcourt', state: 'Rivers', type: 'area', lat: 4.8339, lng: 6.9976 },
    { name: 'Eleme', state: 'Rivers', type: 'lga', lat: 4.7556, lng: 7.1222 },
    { name: 'Obio Akpor', state: 'Rivers', type: 'lga', lat: 4.8690, lng: 6.9890 },
    { name: 'Rumuola', state: 'Rivers', type: 'area', lat: 4.8500, lng: 7.0200 },
    { name: 'Rumuodara', state: 'Rivers', type: 'area', lat: 4.8780, lng: 6.9740 },
    { name: 'Rumuigbo', state: 'Rivers', type: 'area', lat: 4.8760, lng: 6.9810 },
    { name: 'Diobu', state: 'Rivers', type: 'area', lat: 4.8230, lng: 7.0020 },
    { name: 'Borikiri', state: 'Rivers', type: 'area', lat: 4.8070, lng: 7.0200 },
    { name: 'Trans Amadi', state: 'Rivers', type: 'area', lat: 4.8500, lng: 7.0680 },
    { name: 'PH International Airport', state: 'Rivers', type: 'landmark', lat: 5.0155, lng: 6.9496 },
    { name: 'Aba Road', state: 'Rivers', type: 'area', lat: 4.8200, lng: 7.0180 },
    { name: 'Woji', state: 'Rivers', type: 'area', lat: 4.8600, lng: 7.0560 },
    { name: 'Rumuepirikom', state: 'Rivers', type: 'area', lat: 4.8540, lng: 7.0090 },
    { name: 'Ozuoba', state: 'Rivers', type: 'area', lat: 4.9100, lng: 6.9720 },
    { name: 'Nkpolu Rumuola', state: 'Rivers', type: 'area', lat: 4.8490, lng: 7.0170 },
    { name: 'D-Line', state: 'Rivers', type: 'area', lat: 4.8291, lng: 7.0037 },
    { name: 'Peter Odili Road', state: 'Rivers', type: 'area', lat: 4.8450, lng: 6.9870 },
    { name: 'Mile 1', state: 'Rivers', type: 'area', lat: 4.8110, lng: 6.9990 },
    { name: 'Mile 2', state: 'Rivers', type: 'area', lat: 4.8090, lng: 6.9910 },
    { name: 'Garrison', state: 'Rivers', type: 'area', lat: 4.8190, lng: 7.0100 },
  ],

  'Kano': [
    { name: 'Kano City', state: 'Kano', type: 'city', lat: 12.0022, lng: 8.5120 },
    { name: 'Sabon Gari', state: 'Kano', type: 'area', lat: 12.0074, lng: 8.5216 },
    { name: 'Nassarawa', state: 'Kano', type: 'area', lat: 11.9843, lng: 8.5275 },
    { name: 'Fagge', state: 'Kano', type: 'lga', lat: 12.0138, lng: 8.5213 },
    { name: 'Dala', state: 'Kano', type: 'lga', lat: 12.0397, lng: 8.5023 },
    { name: 'Gwale', state: 'Kano', type: 'lga', lat: 12.0119, lng: 8.4964 },
    { name: 'Kano Airport', state: 'Kano', type: 'landmark', lat: 12.0476, lng: 8.5241 },
    { name: 'Emir\'s Palace', state: 'Kano', type: 'landmark', lat: 12.0022, lng: 8.5120 },
    { name: 'Kurmi Market', state: 'Kano', type: 'market', lat: 12.0040, lng: 8.5100 },
    { name: 'Gabasawa', state: 'Kano', type: 'lga', lat: 12.1500, lng: 8.7000 },
    { name: 'Tarauni', state: 'Kano', type: 'lga', lat: 12.0250, lng: 8.5490 },
    { name: 'Bayero University', state: 'Kano', type: 'landmark', lat: 12.0140, lng: 8.4828 },
    { name: 'Zoo Road', state: 'Kano', type: 'area', lat: 12.0000, lng: 8.4870 },
    { name: 'Ibrahim Taiwo Road', state: 'Kano', type: 'area', lat: 12.0097, lng: 8.5179 },
  ],

  'Oyo': [
    { name: 'Ibadan', state: 'Oyo', type: 'city', lat: 7.3776, lng: 3.9470 },
    { name: 'Bodija', state: 'Oyo', type: 'area', lat: 7.3980, lng: 3.9000 },
    { name: 'Ring Road', state: 'Oyo', type: 'area', lat: 7.3860, lng: 3.9180 },
    { name: 'Mokola', state: 'Oyo', type: 'area', lat: 7.4020, lng: 3.9010 },
    { name: 'Dugbe', state: 'Oyo', type: 'area', lat: 7.3850, lng: 3.9120 },
    { name: 'Challenge', state: 'Oyo', type: 'area', lat: 7.3740, lng: 3.9060 },
    { name: 'Agodi', state: 'Oyo', type: 'area', lat: 7.4100, lng: 3.9000 },
    { name: 'University of Ibadan', state: 'Oyo', type: 'landmark', lat: 7.4450, lng: 3.8996 },
    { name: 'Iwo Road', state: 'Oyo', type: 'area', lat: 7.3980, lng: 3.9420 },
    { name: 'New Garage', state: 'Oyo', type: 'area', lat: 7.3900, lng: 3.9550 },
    { name: 'Ojoo', state: 'Oyo', type: 'area', lat: 7.4420, lng: 3.9610 },
    { name: 'Monatan', state: 'Oyo', type: 'area', lat: 7.3690, lng: 3.9950 },
    { name: 'Eleyele', state: 'Oyo', type: 'area', lat: 7.3740, lng: 3.8740 },
    { name: 'Oluyole', state: 'Oyo', type: 'area', lat: 7.3540, lng: 3.9480 },
    { name: 'Akobo', state: 'Oyo', type: 'area', lat: 7.3500, lng: 3.9300 },
    { name: 'Oyo City', state: 'Oyo', type: 'city', lat: 7.8498, lng: 3.9300 },
    { name: 'Ogbomoso', state: 'Oyo', type: 'city', lat: 8.1374, lng: 4.2526 },
    { name: 'Saki', state: 'Oyo', type: 'city', lat: 8.6667, lng: 3.3833 },
    { name: 'Ibadan Airport', state: 'Oyo', type: 'landmark', lat: 7.3623, lng: 3.9783 },
    { name: 'Lekan Salami Stadium', state: 'Oyo', type: 'landmark', lat: 7.3930, lng: 3.9360 },
    { name: 'Cocoa House', state: 'Oyo', type: 'landmark', lat: 7.3878, lng: 3.9132 },
    { name: 'Eleiyele', state: 'Oyo', type: 'area', lat: 7.3804, lng: 3.8767 },
    { name: 'Iyana Church', state: 'Oyo', type: 'area', lat: 7.3650, lng: 3.9350 },
    { name: 'Iyana Ofa', state: 'Oyo', type: 'area', lat: 7.3610, lng: 3.9900 },
    { name: 'Apete', state: 'Oyo', type: 'area', lat: 7.3420, lng: 3.9000 },
    { name: 'Ido', state: 'Oyo', type: 'city', lat: 7.3100, lng: 3.8800 },
  ],

  'Ogun': [
    { name: 'Abeokuta', state: 'Ogun', type: 'city', lat: 7.1551, lng: 3.3450 },
    { name: 'Sagamu', state: 'Ogun', type: 'city', lat: 6.8400, lng: 3.6400 },
    { name: 'Ijebu Ode', state: 'Ogun', type: 'city', lat: 6.8189, lng: 3.9191 },
    { name: 'Ota', state: 'Ogun', type: 'city', lat: 6.6900, lng: 3.2300 },
    { name: 'Agbara', state: 'Ogun', type: 'area', lat: 6.5117, lng: 3.0913 },
    { name: 'Sango Ota', state: 'Ogun', type: 'area', lat: 6.6760, lng: 3.1810 },
    { name: 'Lafenwa', state: 'Ogun', type: 'area', lat: 7.1450, lng: 3.3280 },
    { name: 'Panseke', state: 'Ogun', type: 'area', lat: 7.1540, lng: 3.3640 },
    { name: 'Ifo', state: 'Ogun', type: 'city', lat: 6.8700, lng: 3.1900 },
    { name: 'Ilishan Remo', state: 'Ogun', type: 'city', lat: 6.9200, lng: 3.7200 },
    { name: 'Olusegun Obasanjo Presidential Library', state: 'Ogun', type: 'landmark', lat: 7.1500, lng: 3.3600 },
    { name: 'Ogun State University', state: 'Ogun', type: 'landmark', lat: 6.8450, lng: 3.6380 },
    { name: 'Ogun Light Industrial Area', state: 'Ogun', type: 'area', lat: 6.5200, lng: 3.1100 },
    { name: 'Obafemi Owode', state: 'Ogun', type: 'lga', lat: 7.0100, lng: 3.4400 },
    { name: 'Ijoko', state: 'Ogun', type: 'area', lat: 6.7100, lng: 3.1600 },
  ],

  'Delta': [
    { name: 'Asaba', state: 'Delta', type: 'city', lat: 6.1975, lng: 6.7422 },
    { name: 'Warri', state: 'Delta', type: 'city', lat: 5.5167, lng: 5.7519 },
    { name: 'Sapele', state: 'Delta', type: 'city', lat: 5.8997, lng: 5.6784 },
    { name: 'Ughelli', state: 'Delta', type: 'city', lat: 5.4990, lng: 5.9992 },
    { name: 'Effurun', state: 'Delta', type: 'area', lat: 5.5600, lng: 5.7780 },
    { name: 'Abraka', state: 'Delta', type: 'city', lat: 5.7667, lng: 6.1000 },
    { name: 'Agbor', state: 'Delta', type: 'city', lat: 6.2500, lng: 6.1833 },
    { name: 'Kwale', state: 'Delta', type: 'city', lat: 5.6949, lng: 6.4371 },
    { name: 'Ozoro', state: 'Delta', type: 'city', lat: 5.5400, lng: 6.2200 },
    { name: 'Delta State University', state: 'Delta', type: 'landmark', lat: 5.7830, lng: 6.1070 },
  ],

  'Enugu': [
    { name: 'Enugu City', state: 'Enugu', type: 'city', lat: 6.4584, lng: 7.5248 },
    { name: 'GRA Enugu', state: 'Enugu', type: 'area', lat: 6.4380, lng: 7.5000 },
    { name: 'New Haven', state: 'Enugu', type: 'area', lat: 6.4600, lng: 7.5100 },
    { name: 'Independence Layout', state: 'Enugu', type: 'area', lat: 6.4320, lng: 7.5340 },
    { name: 'Ogui', state: 'Enugu', type: 'area', lat: 6.4700, lng: 7.5300 },
    { name: 'Uwani', state: 'Enugu', type: 'area', lat: 6.4400, lng: 7.5000 },
    { name: 'Agbani', state: 'Enugu', type: 'area', lat: 6.3200, lng: 7.5400 },
    { name: 'Awka', state: 'Enugu', type: 'city', lat: 6.2104, lng: 7.0681 },
    { name: 'Onitsha', state: 'Enugu', type: 'city', lat: 6.1411, lng: 6.7880 },
    { name: 'Nnewi', state: 'Enugu', type: 'city', lat: 6.0149, lng: 6.9160 },
    { name: 'University of Nigeria Nsukka', state: 'Enugu', type: 'landmark', lat: 6.8683, lng: 7.3905 },
    { name: 'Enugu Airport', state: 'Enugu', type: 'landmark', lat: 6.4742, lng: 7.5620 },
  ],

  'Imo': [
    { name: 'Owerri', state: 'Imo', type: 'city', lat: 5.4898, lng: 7.0298 },
    { name: 'New Owerri', state: 'Imo', type: 'area', lat: 5.5000, lng: 7.0000 },
    { name: 'Orlu', state: 'Imo', type: 'city', lat: 5.7919, lng: 6.9977 },
    { name: 'Okigwe', state: 'Imo', type: 'city', lat: 5.8630, lng: 7.3380 },
    { name: 'Ihiala', state: 'Imo', type: 'city', lat: 5.8542, lng: 6.8491 },
    { name: 'Oguta', state: 'Imo', type: 'city', lat: 5.6942, lng: 6.7979 },
    { name: 'Owerri Municipal', state: 'Imo', type: 'area', lat: 5.4939, lng: 7.0332 },
    { name: 'Works Layout', state: 'Imo', type: 'area', lat: 5.4870, lng: 7.0250 },
    { name: 'Douglas Road', state: 'Imo', type: 'area', lat: 5.4810, lng: 7.0310 },
    { name: 'Federal University of Technology Owerri', state: 'Imo', type: 'landmark', lat: 5.3890, lng: 7.0000 },
  ],

  'Kaduna': [
    { name: 'Kaduna City', state: 'Kaduna', type: 'city', lat: 10.5264, lng: 7.4370 },
    { name: 'Barnawa', state: 'Kaduna', type: 'area', lat: 10.4940, lng: 7.4380 },
    { name: 'Rigasa', state: 'Kaduna', type: 'area', lat: 10.5600, lng: 7.4100 },
    { name: 'Narayi', state: 'Kaduna', type: 'area', lat: 10.5190, lng: 7.4060 },
    { name: 'Ungwan Rimi', state: 'Kaduna', type: 'area', lat: 10.5290, lng: 7.4240 },
    { name: 'Zaria', state: 'Kaduna', type: 'city', lat: 11.0800, lng: 7.7083 },
    { name: 'Kafanchan', state: 'Kaduna', type: 'city', lat: 9.5833, lng: 8.3000 },
    { name: 'Kaduna Airport', state: 'Kaduna', type: 'landmark', lat: 10.6960, lng: 7.3201 },
    { name: 'Ahmadu Bello University', state: 'Kaduna', type: 'landmark', lat: 11.1520, lng: 7.6560 },
  ],

  'Edo': [
    { name: 'Benin City', state: 'Edo', type: 'city', lat: 6.3350, lng: 5.6037 },
    { name: 'GRA Benin', state: 'Edo', type: 'area', lat: 6.3540, lng: 5.6010 },
    { name: 'Uselu', state: 'Edo', type: 'area', lat: 6.3650, lng: 5.5930 },
    { name: 'Ring Road', state: 'Edo', type: 'area', lat: 6.3400, lng: 5.6120 },
    { name: 'New Benin', state: 'Edo', type: 'area', lat: 6.3380, lng: 5.6210 },
    { name: 'Upper Sokponba Road', state: 'Edo', type: 'area', lat: 6.3250, lng: 5.6110 },
    { name: 'Ikpoba Hill', state: 'Edo', type: 'area', lat: 6.3300, lng: 5.6400 },
    { name: 'Auchi', state: 'Edo', type: 'city', lat: 7.0669, lng: 6.2671 },
    { name: 'Ekpoma', state: 'Edo', type: 'city', lat: 6.7469, lng: 6.1312 },
    { name: 'University of Benin', state: 'Edo', type: 'landmark', lat: 6.3747, lng: 5.6222 },
    { name: 'Benin Airport', state: 'Edo', type: 'landmark', lat: 6.3172, lng: 5.5995 },
    { name: 'Oba\'s Palace', state: 'Edo', type: 'landmark', lat: 6.3420, lng: 5.6230 },
  ],

  'Ekiti': [
    { name: 'Ado Ekiti', state: 'Ekiti', type: 'city', lat: 7.6211, lng: 5.2186 },
    { name: 'Ikere Ekiti', state: 'Ekiti', type: 'city', lat: 7.4993, lng: 5.2326 },
    { name: 'Ikole Ekiti', state: 'Ekiti', type: 'city', lat: 7.7921, lng: 5.4773 },
    { name: 'Emure Ekiti', state: 'Ekiti', type: 'city', lat: 7.4540, lng: 5.4620 },
    { name: 'Ekiti State University', state: 'Ekiti', type: 'landmark', lat: 7.6390, lng: 5.2370 },
    { name: 'Government House Ado', state: 'Ekiti', type: 'landmark', lat: 7.6270, lng: 5.2120 },
  ],

  'Osun': [
    { name: 'Osogbo', state: 'Osun', type: 'city', lat: 7.7700, lng: 4.5600 },
    { name: 'Ile Ife', state: 'Osun', type: 'city', lat: 7.4667, lng: 4.5667 },
    { name: 'Ilesa', state: 'Osun', type: 'city', lat: 7.6283, lng: 4.7361 },
    { name: 'Ede', state: 'Osun', type: 'city', lat: 7.7333, lng: 4.4333 },
    { name: 'Obafemi Awolowo University', state: 'Osun', type: 'landmark', lat: 7.5242, lng: 4.5236 },
    { name: 'Osun Sacred Grove', state: 'Osun', type: 'landmark', lat: 7.7569, lng: 4.5682 },
  ],

  'Kwara': [
    { name: 'Ilorin', state: 'Kwara', type: 'city', lat: 8.4800, lng: 4.5500 },
    { name: 'GRA Ilorin', state: 'Kwara', type: 'area', lat: 8.4900, lng: 4.5350 },
    { name: 'Challenge', state: 'Kwara', type: 'area', lat: 8.4720, lng: 4.5420 },
    { name: 'Offa', state: 'Kwara', type: 'city', lat: 8.1500, lng: 4.7167 },
    { name: 'Kabba', state: 'Kwara', type: 'city', lat: 7.8333, lng: 6.0667 },
    { name: 'University of Ilorin', state: 'Kwara', type: 'landmark', lat: 8.4799, lng: 4.5474 },
    { name: 'Kwara Mall', state: 'Kwara', type: 'landmark', lat: 8.5050, lng: 4.5900 },
    { name: 'Asa Dam Road', state: 'Kwara', type: 'area', lat: 8.5000, lng: 4.5200 },
  ],

  'Anambra': [
    { name: 'Awka', state: 'Anambra', type: 'city', lat: 6.2104, lng: 7.0681 },
    { name: 'Onitsha', state: 'Anambra', type: 'city', lat: 6.1411, lng: 6.7880 },
    { name: 'Nnewi', state: 'Anambra', type: 'city', lat: 6.0149, lng: 6.9160 },
    { name: 'Ekwulobia', state: 'Anambra', type: 'city', lat: 6.0666, lng: 7.1538 },
    { name: 'Head Bridge Onitsha', state: 'Anambra', type: 'landmark', lat: 6.1440, lng: 6.7700 },
    { name: 'Nnamdi Azikiwe University', state: 'Anambra', type: 'landmark', lat: 6.2192, lng: 7.1124 },
    { name: 'Onitsha Main Market', state: 'Anambra', type: 'market', lat: 6.1561, lng: 6.7861 },
  ],

  'Plateau': [
    { name: 'Jos', state: 'Plateau', type: 'city', lat: 9.9182, lng: 8.8921 },
    { name: 'GRA Jos', state: 'Plateau', type: 'area', lat: 9.9200, lng: 8.8800 },
    { name: 'Terminus', state: 'Plateau', type: 'area', lat: 9.9160, lng: 8.8910 },
    { name: 'Bukuru', state: 'Plateau', type: 'city', lat: 9.7895, lng: 8.8678 },
    { name: 'Barakin Ladi', state: 'Plateau', type: 'city', lat: 9.5419, lng: 8.9041 },
    { name: 'University of Jos', state: 'Plateau', type: 'landmark', lat: 9.9485, lng: 8.8989 },
    { name: 'Jos Museum', state: 'Plateau', type: 'landmark', lat: 9.9200, lng: 8.8985 },
    { name: 'Yankari Game Reserve Road', state: 'Plateau', type: 'landmark', lat: 9.9000, lng: 8.8800 },
  ],

  'Benue': [
    { name: 'Makurdi', state: 'Benue', type: 'city', lat: 7.7300, lng: 8.5370 },
    { name: 'Gboko', state: 'Benue', type: 'city', lat: 7.3281, lng: 8.9960 },
    { name: 'Otukpo', state: 'Benue', type: 'city', lat: 7.1932, lng: 8.1355 },
    { name: 'North Bank Makurdi', state: 'Benue', type: 'area', lat: 7.7409, lng: 8.5325 },
    { name: 'High Level Makurdi', state: 'Benue', type: 'area', lat: 7.7300, lng: 8.5100 },
    { name: 'University of Agriculture Makurdi', state: 'Benue', type: 'landmark', lat: 7.7219, lng: 8.5136 },
  ],

  'Borno': [
    { name: 'Maiduguri', state: 'Borno', type: 'city', lat: 11.8333, lng: 13.1500 },
    { name: 'Biu', state: 'Borno', type: 'city', lat: 10.6050, lng: 12.1980 },
    { name: 'Gwoza', state: 'Borno', type: 'city', lat: 11.1750, lng: 13.6780 },
    { name: 'University of Maiduguri', state: 'Borno', type: 'landmark', lat: 11.8340, lng: 13.0870 },
    { name: 'Maiduguri Airport', state: 'Borno', type: 'landmark', lat: 11.8553, lng: 13.0810 },
  ],

  'Bauchi': [
    { name: 'Bauchi City', state: 'Bauchi', type: 'city', lat: 10.3104, lng: 9.8442 },
    { name: 'Azare', state: 'Bauchi', type: 'city', lat: 11.6832, lng: 10.1901 },
    { name: 'Misau', state: 'Bauchi', type: 'city', lat: 11.2730, lng: 10.0170 },
    { name: 'Yankari Game Reserve', state: 'Bauchi', type: 'landmark', lat: 9.9167, lng: 10.4667 },
    { name: 'Abubakar Tafawa Balewa University', state: 'Bauchi', type: 'landmark', lat: 10.3075, lng: 9.8450 },
  ],

  'Niger': [
    { name: 'Minna', state: 'Niger', type: 'city', lat: 9.6140, lng: 6.5568 },
    { name: 'Bida', state: 'Niger', type: 'city', lat: 9.0763, lng: 6.0144 },
    { name: 'Kontagora', state: 'Niger', type: 'city', lat: 10.4000, lng: 5.4667 },
    { name: 'Suleja', state: 'Niger', type: 'city', lat: 9.1776, lng: 7.1815 },
    { name: 'Bosso', state: 'Niger', type: 'area', lat: 9.6320, lng: 6.5460 },
    { name: 'Federal University of Technology Minna', state: 'Niger', type: 'landmark', lat: 9.6148, lng: 6.5674 },
    { name: 'Kainji Dam', state: 'Niger', type: 'landmark', lat: 9.8756, lng: 4.6395 },
  ],

  'Kebbi': [
    { name: 'Birnin Kebbi', state: 'Kebbi', type: 'city', lat: 12.4500, lng: 4.1973 },
    { name: 'Argungu', state: 'Kebbi', type: 'city', lat: 12.7400, lng: 4.5200 },
    { name: 'Yauri', state: 'Kebbi', type: 'city', lat: 11.8900, lng: 4.8900 },
    { name: 'Kamba', state: 'Kebbi', type: 'city', lat: 12.7580, lng: 3.6760 },
  ],

  'Sokoto': [
    { name: 'Sokoto City', state: 'Sokoto', type: 'city', lat: 13.0059, lng: 5.2320 },
    { name: 'Wamakko', state: 'Sokoto', type: 'area', lat: 13.0400, lng: 5.1700 },
    { name: 'Tambuwal', state: 'Sokoto', type: 'city', lat: 12.4050, lng: 4.6560 },
    { name: 'Sultan\'s Palace', state: 'Sokoto', type: 'landmark', lat: 13.0060, lng: 5.2380 },
    { name: 'Usman Dan Fodio University', state: 'Sokoto', type: 'landmark', lat: 13.0249, lng: 5.2264 },
  ],

  'Katsina': [
    { name: 'Katsina City', state: 'Katsina', type: 'city', lat: 12.9908, lng: 7.6063 },
    { name: 'Daura', state: 'Katsina', type: 'city', lat: 13.0358, lng: 8.2281 },
    { name: 'Funtua', state: 'Katsina', type: 'city', lat: 11.5234, lng: 7.3180 },
    { name: 'Malumfashi', state: 'Katsina', type: 'city', lat: 11.7978, lng: 7.6256 },
    { name: 'Federal University Dutsin-Ma', state: 'Katsina', type: 'landmark', lat: 12.4617, lng: 7.4912 },
  ],

  'Zamfara': [
    { name: 'Gusau', state: 'Zamfara', type: 'city', lat: 12.1702, lng: 6.6601 },
    { name: 'Kaura Namoda', state: 'Zamfara', type: 'city', lat: 12.5978, lng: 6.5918 },
    { name: 'Talata Mafara', state: 'Zamfara', type: 'city', lat: 12.5569, lng: 6.0686 },
  ],

  'Jigawa': [
    { name: 'Dutse', state: 'Jigawa', type: 'city', lat: 11.6639, lng: 9.3404 },
    { name: 'Hadejia', state: 'Jigawa', type: 'city', lat: 12.4573, lng: 10.0481 },
    { name: 'Gumel', state: 'Jigawa', type: 'city', lat: 12.6290, lng: 9.3870 },
    { name: 'Birnin Kudu', state: 'Jigawa', type: 'city', lat: 11.4490, lng: 9.4800 },
  ],

  'Gombe': [
    { name: 'Gombe City', state: 'Gombe', type: 'city', lat: 10.2897, lng: 11.1670 },
    { name: 'Kaltungo', state: 'Gombe', type: 'city', lat: 9.8217, lng: 11.3137 },
    { name: 'Billiri', state: 'Gombe', type: 'city', lat: 9.8600, lng: 10.9700 },
    { name: 'Federal University Kashere', state: 'Gombe', type: 'landmark', lat: 9.9760, lng: 11.2340 },
  ],

  'Yobe': [
    { name: 'Damaturu', state: 'Yobe', type: 'city', lat: 11.7465, lng: 11.9650 },
    { name: 'Potiskum', state: 'Yobe', type: 'city', lat: 11.7079, lng: 11.0790 },
    { name: 'Gashua', state: 'Yobe', type: 'city', lat: 12.8713, lng: 11.0478 },
  ],

  'Adamawa': [
    { name: 'Yola', state: 'Adamawa', type: 'city', lat: 9.2035, lng: 12.4954 },
    { name: 'Jimeta', state: 'Adamawa', type: 'area', lat: 9.2861, lng: 12.4603 },
    { name: 'Mubi', state: 'Adamawa', type: 'city', lat: 10.2695, lng: 13.2596 },
    { name: 'Numan', state: 'Adamawa', type: 'city', lat: 9.4641, lng: 12.0383 },
    { name: 'Modibbo Adama University', state: 'Adamawa', type: 'landmark', lat: 9.2840, lng: 12.4760 },
    { name: 'Yola Airport', state: 'Adamawa', type: 'landmark', lat: 9.2553, lng: 12.4304 },
  ],

  'Taraba': [
    { name: 'Jalingo', state: 'Taraba', type: 'city', lat: 8.8949, lng: 11.3686 },
    { name: 'Wukari', state: 'Taraba', type: 'city', lat: 7.8700, lng: 9.7780 },
    { name: 'Gembu', state: 'Taraba', type: 'city', lat: 6.6968, lng: 11.2658 },
    { name: 'Bali', state: 'Taraba', type: 'city', lat: 7.8667, lng: 10.2000 },
  ],

  'Nasarawa': [
    { name: 'Lafia', state: 'Nasarawa', type: 'city', lat: 8.4947, lng: 8.5225 },
    { name: 'Keffi', state: 'Nasarawa', type: 'city', lat: 8.8500, lng: 7.8750 },
    { name: 'Akwanga', state: 'Nasarawa', type: 'city', lat: 8.9161, lng: 8.4023 },
    { name: 'Nasarawa', state: 'Nasarawa', type: 'city', lat: 8.5476, lng: 7.7004 },
  ],

  'Kogi': [
    { name: 'Lokoja', state: 'Kogi', type: 'city', lat: 7.8014, lng: 6.7424 },
    { name: 'Okene', state: 'Kogi', type: 'city', lat: 7.5524, lng: 6.2378 },
    { name: 'Idah', state: 'Kogi', type: 'city', lat: 7.1095, lng: 6.7378 },
    { name: 'Kabba', state: 'Kogi', type: 'city', lat: 7.8333, lng: 6.0667 },
    { name: 'Confluence of Rivers', state: 'Kogi', type: 'landmark', lat: 7.8017, lng: 6.7680 },
  ],

  'Cross River': [
    { name: 'Calabar', state: 'Cross River', type: 'city', lat: 4.9757, lng: 8.3417 },
    { name: 'GRA Calabar', state: 'Cross River', type: 'area', lat: 4.9650, lng: 8.3150 },
    { name: 'Ikom', state: 'Cross River', type: 'city', lat: 5.9626, lng: 8.7168 },
    { name: 'Ogoja', state: 'Cross River', type: 'city', lat: 6.6500, lng: 8.8000 },
    { name: 'University of Calabar', state: 'Cross River', type: 'landmark', lat: 5.0000, lng: 8.3240 },
    { name: 'Calabar Airport', state: 'Cross River', type: 'landmark', lat: 4.9762, lng: 8.3487 },
    { name: 'Tinapa Resort', state: 'Cross River', type: 'landmark', lat: 5.0100, lng: 8.2900 },
  ],

  'Akwa Ibom': [
    { name: 'Uyo', state: 'Akwa Ibom', type: 'city', lat: 5.0317, lng: 7.9269 },
    { name: 'Eket', state: 'Akwa Ibom', type: 'city', lat: 4.6499, lng: 7.9257 },
    { name: 'Ikot Ekpene', state: 'Akwa Ibom', type: 'city', lat: 5.1793, lng: 7.7132 },
    { name: 'Oron', state: 'Akwa Ibom', type: 'city', lat: 4.8006, lng: 8.2273 },
    { name: 'Itam Uyo', state: 'Akwa Ibom', type: 'area', lat: 5.0080, lng: 7.9310 },
    { name: 'University of Uyo', state: 'Akwa Ibom', type: 'landmark', lat: 5.0510, lng: 7.9380 },
    { name: 'Victor Attah International Airport', state: 'Akwa Ibom', type: 'landmark', lat: 5.0030, lng: 7.9090 },
  ],

  'Abia': [
    { name: 'Umuahia', state: 'Abia', type: 'city', lat: 5.5274, lng: 7.4986 },
    { name: 'Aba', state: 'Abia', type: 'city', lat: 5.1068, lng: 7.3670 },
    { name: 'Ariaria Market', state: 'Abia', type: 'market', lat: 5.1208, lng: 7.3640 },
    { name: 'Michael Okpara University', state: 'Abia', type: 'landmark', lat: 5.5194, lng: 7.4806 },
    { name: 'Aba Shopping Mall', state: 'Abia', type: 'landmark', lat: 5.1050, lng: 7.3620 },
  ],

  'Bayelsa': [
    { name: 'Yenagoa', state: 'Bayelsa', type: 'city', lat: 4.9267, lng: 6.2676 },
    { name: 'Ogbia', state: 'Bayelsa', type: 'city', lat: 4.7269, lng: 6.1981 },
    { name: 'Brass', state: 'Bayelsa', type: 'city', lat: 4.3153, lng: 6.2421 },
    { name: 'Niger Delta University', state: 'Bayelsa', type: 'landmark', lat: 4.7580, lng: 6.1910 },
    { name: 'Isaac Boro Park', state: 'Bayelsa', type: 'landmark', lat: 4.9305, lng: 6.2649 },
  ],

  'Ebonyi': [
    { name: 'Abakaliki', state: 'Ebonyi', type: 'city', lat: 6.3249, lng: 8.1137 },
    { name: 'Onueke', state: 'Ebonyi', type: 'city', lat: 6.2041, lng: 8.0547 },
    { name: 'Edda', state: 'Ebonyi', type: 'city', lat: 5.9400, lng: 7.7230 },
    { name: 'Ebonyi State University', state: 'Ebonyi', type: 'landmark', lat: 6.3251, lng: 8.1131 },
    { name: 'Abakaliki Rice Mill', state: 'Ebonyi', type: 'landmark', lat: 6.3300, lng: 8.1100 },
  ],

  'Ondo': [
    { name: 'Akure', state: 'Ondo', type: 'city', lat: 7.2526, lng: 5.1920 },
    { name: 'Ondo City', state: 'Ondo', type: 'city', lat: 7.0999, lng: 4.8351 },
    { name: 'Okitipupa', state: 'Ondo', type: 'city', lat: 6.5001, lng: 4.7827 },
    { name: 'Ikare', state: 'Ondo', type: 'city', lat: 7.5175, lng: 5.7577 },
    { name: 'Federal University of Technology Akure', state: 'Ondo', type: 'landmark', lat: 7.2990, lng: 5.1310 },
    { name: 'Akure Airport', state: 'Ondo', type: 'landmark', lat: 7.2467, lng: 5.3010 },
  ],

  'FCT': [
    { name: 'Maitama', state: 'FCT', type: 'area', lat: 9.0781, lng: 7.5053 },
    { name: 'Wuse II', state: 'FCT', type: 'area', lat: 9.0722, lng: 7.4697 },
    { name: 'Garki', state: 'FCT', type: 'area', lat: 9.0424, lng: 7.4842 },
    { name: 'Asokoro', state: 'FCT', type: 'area', lat: 9.0429, lng: 7.5234 },
    { name: 'Gudu', state: 'FCT', type: 'area', lat: 8.9820, lng: 7.4380 },
    { name: 'Jabi', state: 'FCT', type: 'area', lat: 9.0671, lng: 7.4369 },
    { name: 'Kubwa', state: 'FCT', type: 'city', lat: 9.1488, lng: 7.3153 },
    { name: 'Gwagwalada', state: 'FCT', type: 'city', lat: 8.9417, lng: 7.0853 },
    { name: 'Aso Rock', state: 'FCT', type: 'landmark', lat: 9.0570, lng: 7.5145 },
    { name: 'Abuja Airport', state: 'FCT', type: 'landmark', lat: 9.0067, lng: 7.2631 },
    { name: 'National Assembly', state: 'FCT', type: 'landmark', lat: 9.0660, lng: 7.5070 },
    { name: 'Abuja Mall', state: 'FCT', type: 'landmark', lat: 9.0680, lng: 7.4340 },
    { name: 'Transcorp Hilton', state: 'FCT', type: 'landmark', lat: 9.0680, lng: 7.4892 },
    { name: 'Berger Roundabout', state: 'FCT', type: 'landmark', lat: 9.0440, lng: 7.4730 },
    { name: 'Gwarinpa', state: 'FCT', type: 'area', lat: 9.1112, lng: 7.3974 },
    { name: 'Lugbe', state: 'FCT', type: 'area', lat: 8.9940, lng: 7.4000 },
    { name: 'Karu', state: 'FCT', type: 'area', lat: 9.0378, lng: 7.5738 },
    { name: 'Nyanya', state: 'FCT', type: 'area', lat: 9.0194, lng: 7.5499 },
    { name: 'Utako', state: 'FCT', type: 'area', lat: 9.0650, lng: 7.4480 },
    { name: 'Wuse', state: 'FCT', type: 'area', lat: 9.0606, lng: 7.4700 },
    { name: 'Central Area', state: 'FCT', type: 'area', lat: 9.0565, lng: 7.4890 },
    { name: 'Apo', state: 'FCT', type: 'area', lat: 9.0130, lng: 7.5180 },
    { name: 'Wuye', state: 'FCT', type: 'area', lat: 9.0840, lng: 7.4410 },
    { name: 'Katampe', state: 'FCT', type: 'area', lat: 9.1100, lng: 7.4270 },
    { name: 'Life Camp', state: 'FCT', type: 'area', lat: 9.0980, lng: 7.4080 },
    { name: 'Galadimawa', state: 'FCT', type: 'area', lat: 9.0170, lng: 7.4390 },
  ],
};

// Get all locations for given active states
export function getLocationsForStates(activeStates: string[]): NigerianLocation[] {
  if (!activeStates || activeStates.length === 0) {
    // Return all locations if no states set
    return Object.values(NIGERIAN_LOCATIONS_BY_STATE).flat();
  }
  return activeStates.flatMap(state => {
    const stateKey = Object.keys(NIGERIAN_LOCATIONS_BY_STATE).find(
      k => k.toLowerCase() === state.toLowerCase() ||
      state.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(state.toLowerCase())
    );
    return stateKey ? NIGERIAN_LOCATIONS_BY_STATE[stateKey] : [];
  });
}

// Search locations by query
export function searchLocations(query: string, activeStates: string[]): NigerianLocation[] {
  const available = getLocationsForStates(activeStates);
  const q = query.toLowerCase().trim();
  if (!q) return available.slice(0, 15);
  return available.filter(loc =>
    loc.name.toLowerCase().includes(q) ||
    loc.state.toLowerCase().includes(q) ||
    loc.type.toLowerCase().includes(q)
  ).slice(0, 12);
}

// Get coords for a location name
export function getLocationCoords(name: string, activeStates: string[]): [number, number] | null {
  const available = getLocationsForStates(activeStates);
  const found = available.find(loc =>
    loc.name.toLowerCase() === name.toLowerCase() ||
    loc.name.toLowerCase().includes(name.toLowerCase()) ||
    name.toLowerCase().includes(loc.name.toLowerCase())
  );
  if (found) return [found.lng, found.lat];
  // Fall back to state coords
  const stateCoord = NIGERIAN_STATE_COORDS[name];
  if (stateCoord) return stateCoord;
  return null;
}

export const ALL_NIGERIAN_STATES = Object.keys(NIGERIAN_STATE_COORDS).sort();
