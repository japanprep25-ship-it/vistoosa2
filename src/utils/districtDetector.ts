// districtDetector.ts
// -----------------------------------------------------------------------
// Bangladesh 64 District Reference Dataset & Automatic Detection Engine
// Maps City/Upazila/Thana/Area names from address/city string to exact District.
// Also provides auto-mapping to Pathao Courier City ID & Zone ID.

export interface DistrictInfo {
  name: string; // Canonical English name e.g. "Dhaka", "Chattogram", "Cumilla"
  bnName: string; // Bangla name e.g. "ঢাকা", "চট্টগ্রাম", "কুমিল্লা"
  aliases: string[]; // Alternative spellings / English / Bangla
  areas: string[]; // Thanas, Upazilas, key areas, landmarks
  defaultPathaoCityId?: number; // Pre-mapped Pathao City ID
  defaultPathaoCityName?: string;
}

// 64 Districts Dataset with Thanas / Upazilas / Key Areas
export const BANGLADESH_DISTRICTS: DistrictInfo[] = [
  {
    name: 'Dhaka',
    bnName: 'ঢাকা',
    aliases: ['dhaka', 'dacca', 'ঢাকা', 'inside dhaka', 'sub-dhaka', 'sub dhaka'],
    defaultPathaoCityId: 1,
    defaultPathaoCityName: 'Dhaka',
    areas: [
      'banani', 'gulshan', 'mirpur', 'uttara', 'dhanmondi', 'badda', 'tejgaon', 'motijheel',
      'khilgaon', 'rampura', 'paltan', 'malibagh', 'jatrabari', 'mohammadpur', 'savar',
      'dhamrai', 'keraniganj', 'dohar', 'nawabganj', 'bashundhara', 'nikunja', 'cantonment',
      'kafrul', 'shahbagh', 'lalbagh', 'hazaribagh', 'kamrangirchar', 'demra', 'kadamtali',
      'sabujbagh', 'turag', 'uttarkhan', 'dakshinkhan', 'khilkhet', 'vatara', 'adabor',
      'sher-e-bangla nagar', 'shyamoli', 'kalyanpur', 'gopibagh', 'wari', 'sutrapur',
      'kotwali dhaka', 'banglamotor', 'farmgate', 'moghbazar', 'agargaon', 'niketan', 'mojakhali',
      'baridhara', 'aftabnagar', 'mirpur-1', 'mirpur-2', 'mirpur-10', 'mirpur-11', 'mirpur-12',
      'mirpur-14', 'uttara-1', 'uttara-3', 'uttara-7', 'uttara-10', 'uttara-12', 'uttara-13', 'uttara-14'
    ],
  },
  {
    name: 'Gazipur',
    bnName: 'গাজীপুর',
    aliases: ['gazipur', 'গাজীপুর', 'gazi pur'],
    defaultPathaoCityId: 2,
    defaultPathaoCityName: 'Gazipur',
    areas: ['tongi', 'board bazar', 'chourasta', 'konabari', 'kaliakair', 'kapasia', 'sreepur', 'kaliganj gazipur', 'salna', 'shafipur', 'bogra gazipur', 'joydebpur'],
  },
  {
    name: 'Narayanganj',
    bnName: 'নারায়ণগঞ্জ',
    aliases: ['narayanganj', 'narayanganj', 'নারায়ণগঞ্জ', 'narayangonj'],
    defaultPathaoCityId: 3,
    defaultPathaoCityName: 'Narayanganj',
    areas: ['chashara', 'siddhirganj', 'fatullah', 'kanchpur', 'rupganj', 'sonargaon', 'araihazar', 'bandar narayanganj', 'simrail', 'adamjee'],
  },
  {
    name: 'Chattogram',
    bnName: 'চট্টগ্রাম',
    aliases: ['chattogram', 'chittagong', 'চট্টগ্রাম', 'ctg'],
    defaultPathaoCityId: 4,
    defaultPathaoCityName: 'Chittagong',
    areas: [
      'agrabad', 'gec', 'nasirabad', 'halishahar', 'khulshi', 'chawkbazar', 'pahartali',
      'patenga', 'kotwali ctg', 'panchlaish', 'double mooring', 'bayezid', 'bakalia',
      'hathazari', 'sitakunda', 'mirsarai', 'patiya', 'fatikchhari', 'boalkhali',
      'raozan', 'rangunia', 'sandwip', 'answara', 'chandanpura', 'alkaran', 'muradpur',
      'lalkhan bazar', 'oxygen', 'sholashahar', 'epz ctg', 'karnaphuli'
    ],
  },
  {
    name: 'Cumilla',
    bnName: 'কুমিল্লা',
    aliases: ['cumilla', 'comilla', 'কুমিল্লা'],
    defaultPathaoCityId: 10,
    defaultPathaoCityName: 'Cumilla',
    areas: [
      'kandirpar', 'paduar bazar', 'comilla sadar', 'cumilla sadar', 'daudkandi', 'laksham',
      'chandina', 'debidwar', 'burichang', 'choddagram', 'brahmanpara', 'homna',
      'muradnagar', 'nangalkot', 'tippera', 'epz comilla', 'jhawtola comilla', 'tomsom bridge'
    ],
  },
  {
    name: 'Sylhet',
    bnName: 'সিলেট',
    aliases: ['sylhet', 'সিলেট'],
    defaultPathaoCityId: 5,
    defaultPathaoCityName: 'Sylhet',
    areas: [
      'zindabazar', 'shibganj sylhet', 'amberkhana', 'chouhatta', 'kumarpara', 'upashahar sylhet',
      'sylhet sadar', 'beanibazar', 'golapganj', 'zakiganj', 'fenchuganj', 'biswanath',
      'balaganj', 'companiganj sylhet', 'gowainghat', 'kanaighat', 'kadamtali sylhet', 'moulding bazar'
    ],
  },
  {
    name: 'Bogura',
    bnName: 'বগুড়া',
    aliases: ['bogura', 'bogra', 'বগুড়া'],
    defaultPathaoCityId: 8,
    defaultPathaoCityName: 'Bogra',
    areas: ['bogra sadar', 'shajahanpur bogra', 'sherpur bogra', 'kahaloo', 'dupchanchia', 'shibganj bogra', 'gabatali', 'sariakandi', 'sonatola', 'satmatha'],
  },
  {
    name: 'Rajshahi',
    bnName: 'রাজশাহী',
    aliases: ['rajshahi', 'রাজশাহী'],
    defaultPathaoCityId: 6,
    defaultPathaoCityName: 'Rajshahi',
    areas: ['saheb bazar', 'kazla', 'motihar', 'boalia', 'rajpara', 'chandaikuri', 'paba', 'godagari', 'tanore', 'bagha', 'puthia', 'charghat', 'durgapur rajshahi', 'mohonpur'],
  },
  {
    name: 'Rangpur',
    bnName: 'রংপুর',
    aliases: ['rangpur', 'রংপুর'],
    defaultPathaoCityId: 11,
    defaultPathaoCityName: 'Rangpur',
    areas: ['rangpur sadar', 'modern mor', 'dhap', 'pairaband', 'mithapukur', 'pirganj rangpur', 'badarganj', 'gangachara', 'kaunia', 'pirgachha', 'taraganj', 'carmichael'],
  },
  {
    name: 'Khulna',
    bnName: 'খুলনা',
    aliases: ['khulna', 'খুলনা'],
    defaultPathaoCityId: 7,
    defaultPathaoCityName: 'Khulna',
    areas: ['daulatpur khulna', 'khalishpur', 'sonadanga', 'boyra', 'khulna sadar', 'phultala', 'dighalia', 'terokhada', 'rupsha', 'batiaghata', 'dumuria', 'paikgachha', 'koyra', 'dacope'],
  },
  {
    name: 'Barishal',
    bnName: 'বরিশাল',
    aliases: ['barishal', 'barisal', 'বরিশাল'],
    defaultPathaoCityId: 9,
    defaultPathaoCityName: 'Barisal',
    areas: ['sadar road barishal', 'c&b road', 'rupatali', 'natun bazar barishal', 'barishal sadar', 'babuganj', 'bakerganj', 'banaripara', 'gaurnadi', 'hizla', 'mehendiganj', 'muladi', 'wazirpur'],
  },
  {
    name: 'Mymensingh',
    bnName: 'ময়মনসিংহ',
    aliases: ['mymensingh', 'ময়মনসিংহ', 'mymensing'],
    defaultPathaoCityId: 12,
    defaultPathaoCityName: 'Mymensingh',
    areas: ['ganginar par', 'town hall mymensingh', 'mymensingh sadar', 'trishal', 'fulbaria', 'gauripur', 'bhaluka', 'muktagacha', 'haluaghat', 'dhobaura', 'phulpur', 'tarakanda', 'isshwarganj', 'nandail'],
  },
  {
    name: 'Jashore',
    bnName: 'যশোর',
    aliases: ['jashore', 'jessore', 'যশোর'],
    defaultPathaoCityId: 13,
    defaultPathaoCityName: 'Jessore',
    areas: ['jashore sadar', 'doratana', 'chaugachha', 'jhikargachha', 'bagherpara', 'abhaynagar', 'monirampur', 'keshabpur', 'sharsha', 'benapole'],
  },
  {
    name: 'Narsingdi',
    bnName: 'নরসিংদী',
    aliases: ['narsingdi', 'নরসিংদী', 'norshingdi'],
    defaultPathaoCityId: 14,
    defaultPathaoCityName: 'Narsingdi',
    areas: ['narsingdi sadar', 'madhabdi', 'palash', 'shibpur narsingdi', 'raipura', 'monohardi', 'belabo', 'velanagar'],
  },
  {
    name: 'Cox\'s Bazar',
    bnName: 'কক্সবাজার',
    aliases: ['cox\'s bazar', 'coxs bazar', 'coxbazar', 'কক্সবাজার'],
    defaultPathaoCityId: 15,
    defaultPathaoCityName: 'Coxs Bazar',
    areas: ['kolatoli', 'laboni', 'sugandha', 'teknaf', 'ukhiya', 'ramu', 'chakaria', 'peua', 'moheshkhali', 'kutubdia', 'coxs bazar sadar'],
  },
  {
    name: 'Feni',
    bnName: 'ফেনী',
    aliases: ['feni', 'ফেনী'],
    defaultPathaoCityId: 16,
    defaultPathaoCityName: 'Feni',
    areas: ['feni sadar', 'trunk road feni', 'daganbhuiyan', 'chagalnaiya', 'parshuram', 'fulgazi', 'sonagazi', 'grand trunk road'],
  },
  {
    name: 'Noakhali',
    bnName: 'নোয়াখালী',
    aliases: ['noakhali', 'নোয়াখালী'],
    defaultPathaoCityId: 17,
    defaultPathaoCityName: 'Noakhali',
    areas: ['maijdee', 'chowmuhani', 'begumganj', 'senbagh', 'chatkhil', 'companiganj noakhali', 'hatiya', 'subarnachar', 'kabirhat'],
  },
  {
    name: 'Pabna',
    bnName: 'পাবনা',
    aliases: ['pabna', 'পাবনা'],
    defaultPathaoCityId: 18,
    defaultPathaoCityName: 'Pabna',
    areas: ['pabna sadar', 'ishwardi', 'santhia', 'sujanagar', 'chatmohar', 'bhanga pabna', 'atgharia', 'bera', 'faridpur pabna'],
  },
  {
    name: 'Kushtia',
    bnName: 'কুষ্টিয়া',
    aliases: ['kushtia', 'কুষ্টিয়া'],
    defaultPathaoCityId: 19,
    defaultPathaoCityName: 'Kushtia',
    areas: ['kushtia sadar', 'kumarkhali', 'khoksa', 'mirpur kushtia', 'bheramara', 'daulatpur kushtia', 'ns road kushtia'],
  },
  {
    name: 'Dinajpur',
    bnName: 'দিনাজপুর',
    aliases: ['dinajpur', 'দিনাজপুর'],
    defaultPathaoCityId: 20,
    defaultPathaoCityName: 'Dinajpur',
    areas: ['dinajpur sadar', 'pulhat', 'birampur', 'birganj', 'biral', 'fulbari dinajpur', 'hakimpur', 'kaharole', 'khansama', 'nawabganj dinajpur', 'parbatipur'],
  },
  {
    name: 'Brahmanbaria',
    bnName: 'ব্রাহ্মণবাড়িয়া',
    aliases: ['brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'bbaria', 'b-baria'],
    defaultPathaoCityId: 21,
    defaultPathaoCityName: 'Brahmanbaria',
    areas: ['brahmanbaria sadar', 'ashuganj', 'akhaura', 'bancharampur', 'kasba', 'nabinagar', 'nasirnagar', 'sarail', 'bijoynagar'],
  },
  {
    name: 'Chandpur',
    bnName: 'চাঁদপুর',
    aliases: ['chandpur', 'চাঁদপুর'],
    defaultPathaoCityId: 22,
    defaultPathaoCityName: 'Chandpur',
    areas: ['chandpur sadar', 'hajiganj', 'matlab', 'faridganj', 'kachua', 'shahrasti', 'haimchar'],
  },
  {
    name: 'Lakshmipur',
    bnName: 'লক্ষ্মীপুর',
    aliases: ['lakshmipur', 'লক্ষ্মীপুর', 'laxmipur'],
    defaultPathaoCityId: 23,
    defaultPathaoCityName: 'Lakshmipur',
    areas: ['lakshmipur sadar', 'ramganj', 'ramgati', 'raipur lakshmipur', 'kamalnagar'],
  },
  {
    name: 'Tangail',
    bnName: 'টাঙ্গাইল',
    aliases: ['tangail', 'টাঙ্গাইল'],
    defaultPathaoCityId: 24,
    defaultPathaoCityName: 'Tangail',
    areas: ['tangail sadar', 'mirzapur', 'kalihati', 'ghatail', 'sakhipur', 'delduar', 'nagarpur', 'basail', 'bhuapur', 'gopalpur tangail', 'dhanbari', 'madhupur'],
  },
  {
    name: 'Moulvibazar',
    bnName: 'মৌলভীবাজার',
    aliases: ['moulvibazar', 'মৌলভীবাজার', 'moulvibazar'],
    defaultPathaoCityId: 25,
    defaultPathaoCityName: 'Moulvibazar',
    areas: ['moulvibazar sadar', 'sreemangal', 'kulaura', 'barlekha', 'juri', 'rajanagar', 'kamalganj'],
  },
  {
    name: 'Habiganj',
    bnName: 'হবিগঞ্জ',
    aliases: ['habiganj', 'হবিগঞ্জ', 'hobiganj'],
    defaultPathaoCityId: 26,
    defaultPathaoCityName: 'Habiganj',
    areas: ['habiganj sadar', 'nabiganj', 'madhabpur', 'chunarughat', 'bahubal', 'baniachong', 'ajmiriganj', 'lakhai'],
  },
  {
    name: 'Sunamganj',
    bnName: 'সুনামগঞ্জ',
    aliases: ['sunamganj', 'সুনামগঞ্জ'],
    defaultPathaoCityId: 27,
    defaultPathaoCityName: 'Sunamganj',
    areas: ['sunamganj sadar', 'chhatak', 'jagannathpur', 'derai', 'tahirpur', 'dowarabazar', 'bishwamvarpur', 'jamalganj', 'shulla'],
  },
  {
    name: 'Tangail',
    bnName: 'টাঙ্গাইল',
    aliases: ['tangail', 'টাঙ্গাইল'],
    areas: ['tangail sadar', 'mirzapur', 'kalihati', 'ghatail', 'sakhipur', 'delduar', 'nagarpur', 'basail'],
  },
  {
    name: 'Faridpur',
    bnName: 'ফরিদপুর',
    aliases: ['faridpur', 'ফরিদপুর'],
    areas: ['faridpur sadar', 'bhanga', 'boalmari', 'alfadanga', 'charbhadrasan', 'madhukhali', 'nagarkanda', 'sadarpur', 'saltha'],
  },
  {
    name: 'Madaripur',
    bnName: 'মাদারীপুর',
    aliases: ['madaripur', 'মাদারীপুর'],
    areas: ['madaripur sadar', 'shibchar', 'kalkini', 'rajoir'],
  },
  {
    name: 'Gopalganj',
    bnName: 'গোপালগঞ্জ',
    aliases: ['gopalganj', 'গোপালগঞ্জ'],
    areas: ['gopalganj sadar', 'kashiani', 'kotalipara', 'muktagonj', 'tungipara'],
  },
  {
    name: 'Manikganj',
    bnName: 'মানিকগঞ্জ',
    aliases: ['manikganj', 'মানিকগঞ্জ'],
    areas: ['manikganj sadar', 'singair', 'saturia', 'ghior', 'shivalaya', 'harirampur', 'daulatpur manikganj'],
  },
  {
    name: 'Munshiganj',
    bnName: 'মুন্সীগঞ্জ',
    aliases: ['munshiganj', 'মুন্সীগঞ্জ', 'bikrampur'],
    areas: ['munshiganj sadar', 'tongibari', 'sreenagar', 'sirajdikhan', 'louhajang', 'gajaria'],
  },
  {
    name: 'Rajbari',
    bnName: 'রাজবাড়ী',
    aliases: ['rajbari', 'রাজবাড়ী'],
    areas: ['rajbari sadar', 'pangsha', 'baliakandi', 'goalanda', 'kalukhali'],
  },
  {
    name: 'Shariatpur',
    bnName: 'শরীয়তপুর',
    aliases: ['shariatpur', 'শরীয়তপুর'],
    areas: ['shariatpur sadar', 'zajira', 'naria', 'bhedarganj', 'damudya', 'gosairhat'],
  },
  {
    name: 'Kishoreganj',
    bnName: 'কিশোরগঞ্জ',
    aliases: ['kishoreganj', 'কিশোরগঞ্জ'],
    areas: ['kishoreganj sadar', 'bhairab', 'itna', 'karimganj', 'katiadi', 'kuliarchar', 'mithamain', 'nikli', 'pakundia', 'tarail', 'bajitpur'],
  },
  {
    name: 'Khagrachhari',
    bnName: 'খাগড়াছড়ি',
    aliases: ['khagrachhari', 'khagrachari', 'খাগড়াছড়ি'],
    areas: ['khagrachhari sadar', 'dighinala', 'panchhari', 'mahalchhari', 'matiranga', 'ramgarh', 'manikchhari', 'lakshmichhari'],
  },
  {
    name: 'Rangamati',
    bnName: 'রাঙ্গামাটি',
    aliases: ['rangamati', 'রাঙ্গামাটি'],
    areas: ['rangamati sadar', 'kaptai', 'kawkhali', 'baghaichhari', 'barkal', 'langadu', 'naniarchar', 'rajasthali', 'juraichhari'],
  },
  {
    name: 'Bandarban',
    bnName: 'বান্দরবান',
    aliases: ['bandarban', 'বান্দরবান'],
    areas: ['bandarban sadar', 'thanchi', 'lama', 'alikadam', 'rowangchhari', 'ruma', 'naikhongchhari'],
  },
  {
    name: 'Naogaon',
    bnName: 'নওগাঁ',
    aliases: ['naogaon', 'নওগাঁ'],
    areas: ['naogaon sadar', 'patnitala', 'dhamoirhat', 'badalgachhi', 'raninagar', 'atrai', 'mahadevpur', 'manda', 'niamatpur', 'porsha', 'sapahar'],
  },
  {
    name: 'Natore',
    bnName: 'নাটোর',
    aliases: ['natore', 'নাটোর'],
    areas: ['natore sadar', 'singra', 'baraigram', 'bagatipara', 'lalpur', 'gurudaspur', 'naldanga'],
  },
  {
    name: 'Sirajganj',
    bnName: 'সিরাজগঞ্জ',
    aliases: ['sirajganj', 'সিরাজগঞ্জ'],
    areas: ['sirajganj sadar', 'shahjadpur', 'ullapara', 'belkuchi', 'kazipur', 'kamarkhanda', 'tarash', 'rayganj', 'chauhali'],
  },
  {
    name: 'Chapainawabganj',
    bnName: 'চাঁপাইনবাবগঞ্জ',
    aliases: ['chapainawabganj', 'চাঁপাইনবাবগঞ্জ', 'nawabganj rajshahi'],
    areas: ['chapainawabganj sadar', 'shibganj chapai', 'gomastapur', 'nachole', 'bholahat'],
  },
  {
    name: 'Joypurhat',
    bnName: 'জয়পুরহাট',
    aliases: ['joypurhat', 'জয়পুরহাট'],
    areas: ['joypurhat sadar', 'akkelpur', 'kalai', 'khetlal', 'panchbibi'],
  },
  {
    name: 'Gaibandha',
    bnName: 'গাইবান্ধা',
    aliases: ['gaibandha', 'গাইবান্ধা'],
    areas: ['gaibandha sadar', 'gobindaganj', 'palashbari', 'sadullapur', 'sundarganj', 'saghata', 'fulchhari'],
  },
  {
    name: 'Kurigram',
    bnName: 'কুড়িগ্রাম',
    aliases: ['kurigram', 'কুড়িগ্রাম'],
    areas: ['kurigram sadar', 'nageshwari', 'bhurungamari', 'ulipur', 'chilmari', 'rajarhat', 'phulbari kurigram', 'raomari', 'char rajibpur'],
  },
  {
    name: 'Lalmonirhat',
    bnName: 'লালমনিরহাট',
    aliases: ['lalmonirhat', 'লালমনিরহাট'],
    areas: ['lalmonirhat sadar', 'patgram', 'hatibandha', 'kaliganj lalmonirhat', 'aditmari'],
  },
  {
    name: 'Nilphamari',
    bnName: 'নীলফামারী',
    aliases: ['nilphamari', 'নীলফামারী'],
    areas: ['nilphamari sadar', 'saidpur', 'domar', 'dimla', 'jaldhaka', 'kishorganj nilphamari'],
  },
  {
    name: 'Panchagarh',
    bnName: 'পঞ্চগড়',
    aliases: ['panchagarh', 'পঞ্চগড়'],
    areas: ['panchagarh sadar', 'tetulia', 'boda', 'atwari', 'debiganj'],
  },
  {
    name: 'Thakurgaon',
    bnName: 'ঠাকুরগাঁও',
    aliases: ['thakurgaon', 'ঠাকুরগাঁও'],
    areas: ['thakurgaon sadar', 'pirganj thakurgaon', 'ranisankail', 'baliadangi', 'haripur'],
  },
  {
    name: 'Bagerhat',
    bnName: 'বাগেরহাট',
    aliases: ['bagerhat', 'বাগেরহাট'],
    areas: ['bagerhat sadar', 'mongla', 'rampal', 'morrelganj', 'kachua bagerhat', 'sarankhola', 'mollahat', 'fakirhat', 'chitalmari'],
  },
  {
    name: 'Satkhira',
    bnName: 'সাতক্ষীরা',
    aliases: ['satkhira', 'সাতক্ষীরা'],
    areas: ['satkhira sadar', 'kalaroa', 'tala', 'debhata', 'kaliganj satkhira', 'assasuni', 'shyamnagar'],
  },
  {
    name: 'Jhenaidah',
    bnName: 'ঝিনাইদহ',
    aliases: ['jhenaidah', 'ঝিনাইদহ'],
    areas: ['jhenaidah sadar', 'shailkupa', 'kaliganj jhenaidah', 'kotchandpur', 'moheshpur', 'harinakundu'],
  },
  {
    name: 'Chuadanga',
    bnName: 'চুয়াডাঙ্গা',
    aliases: ['chuadanga', 'চুয়াডাঙ্গা'],
    areas: ['chuadanga sadar', 'alamdanga', 'damurhuda', 'jibannagar'],
  },
  {
    name: 'Meherpur',
    bnName: 'মেহেরপুর',
    aliases: ['meherpur', 'মেহেরপুর'],
    areas: ['meherpur sadar', 'gangni', 'mujibnagar'],
  },
  {
    name: 'Magura',
    bnName: 'মাগুরা',
    aliases: ['magura', 'মাগুরা'],
    areas: ['magura sadar', 'mohammadpur magura', 'shalikha', 'sreepur magura'],
  },
  {
    name: 'Narail',
    bnName: 'নড়াইল',
    aliases: ['narail', 'নড়াইল'],
    areas: ['narail sadar', 'kalia', 'lohagagara narail'],
  },
  {
    name: 'Bhola',
    bnName: 'ভোলা',
    aliases: ['bhola', 'ভোলা'],
    areas: ['bhola sadar', 'borhanuddin', 'daulatkhan', 'lalmohan', 'char fasson', 'tajumuddin', 'manpura'],
  },
  {
    name: 'Patuakhali',
    bnName: 'পটুয়াখালী',
    aliases: ['patuakhali', 'পটুয়াখালী'],
    areas: ['patuakhali sadar', 'kuakata', 'galachipa', 'kalapara', 'bauphal', 'dumki', 'dashmina', 'mirzaganj'],
  },
  {
    name: 'Pirojpur',
    bnName: 'পিরোজপুর',
    aliases: ['pirojpur', 'পিরোজপুর'],
    areas: ['pirojpur sadar', 'bhandaria', 'mathbaria', 'naziropur', 'nesarabad', 'kawkhali pirojpur', 'zianagar'],
  },
  {
    name: 'Barguna',
    bnName: 'বরগুনা',
    aliases: ['barguna', 'বরগুনা'],
    areas: ['barguna sadar', 'amatali', 'patharghata', 'betagi', 'bamna', 'taltali'],
  },
  {
    name: 'Jhalokati',
    bnName: 'ঝালকাঠি',
    aliases: ['jhalokati', 'jhalakati', 'ঝালকাঠি'],
    areas: ['jhalokati sadar', 'kathalia', 'nalchity', 'rajapur'],
  },
  {
    name: 'Jamalpur',
    bnName: 'জামালপুর',
    aliases: ['jamalpur', 'জামালপুর'],
    areas: ['jamalpur sadar', 'sarishabari', 'melandahn', 'isampur', 'dewanganj', 'baksiganj', 'madarganj'],
  },
  {
    name: 'Netrokona',
    bnName: 'নেত্রকোণা',
    aliases: ['netrokona', 'netrakona', 'নেত্রকোণা'],
    areas: ['netrokona sadar', 'kendua', 'durgapur netrokona', 'mohanganj', 'atpara', 'barhatta', 'kalmakanda', 'madan', 'khaliajuri', 'purbadhala'],
  },
  {
    name: 'Sherpur',
    bnName: 'শেরপুর',
    aliases: ['sherpur', 'শেরপুর'],
    areas: ['sherpur sadar', 'nakla', 'nalitabari', 'jhinaigati', 'sreebardi'],
  },
];

// Helper to sanitize & normalize text
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Automatically detects Bangladesh District based on Address and City inputs.
 * Returns District name (e.g., "Dhaka", "Chattogram", "Cumilla") or null if uncertain/unmatched.
 */
export function detectDistrict(address: string, city: string): {
  district: string | null;
  confidence: 'high' | 'medium' | 'uncertain';
  matchedBy?: 'explicit_district' | 'area_keyword' | 'city_keyword';
  pathaoCityId?: number;
} {
  const normAddress = normalizeText(address);
  const normCity = normalizeText(city);
  const combinedText = `${normCity} ${normAddress}`.trim();

  if (!combinedText) {
    return { district: null, confidence: 'uncertain' };
  }

  // Step 1: Direct District Name Match (Exact or Alias)
  let directMatches: { dist: DistrictInfo; matchedTerm: string }[] = [];

  for (const dist of BANGLADESH_DISTRICTS) {
    // Check canonical name & aliases
    const nameList = [dist.name, dist.bnName, ...dist.aliases];
    for (const alias of nameList) {
      const normAlias = normalizeText(alias);
      if (!normAlias) continue;

      // Word boundary match or inclusion check
      const regex = new RegExp(`(?:^|\\s)${normAlias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:$|\\s)`, 'i');
      if (regex.test(combinedText)) {
        directMatches.push({ dist, matchedTerm: alias });
        break;
      }
    }
  }

  if (directMatches.length === 1) {
    const d = directMatches[0].dist;
    return {
      district: d.name,
      confidence: 'high',
      matchedBy: 'explicit_district',
      pathaoCityId: d.defaultPathaoCityId,
    };
  }

  // Step 2: Thana / Upazila / Key Area Matching
  const areaMatchesMap = new Map<string, { dist: DistrictInfo; areaCount: number }>();

  for (const dist of BANGLADESH_DISTRICTS) {
    let matchedAreasCount = 0;
    for (const area of dist.areas) {
      const normArea = normalizeText(area);
      if (!normArea || normArea.length < 3) continue;

      const regex = new RegExp(`(?:^|\\s)${normArea.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:$|\\s)`, 'i');
      if (regex.test(combinedText)) {
        matchedAreasCount++;
      }
    }

    if (matchedAreasCount > 0) {
      areaMatchesMap.set(dist.name, { dist, areaCount: matchedAreasCount });
    }
  }

  if (areaMatchesMap.size === 1) {
    const singleMatch = Array.from(areaMatchesMap.values())[0];
    return {
      district: singleMatch.dist.name,
      confidence: 'high',
      matchedBy: 'area_keyword',
      pathaoCityId: singleMatch.dist.defaultPathaoCityId,
    };
  } else if (areaMatchesMap.size > 1) {
    // Sort by most matched areas
    const sorted = Array.from(areaMatchesMap.values()).sort((a, b) => b.areaCount - a.areaCount);
    if (sorted[0].areaCount > sorted[1].areaCount) {
      return {
        district: sorted[0].dist.name,
        confidence: 'medium',
        matchedBy: 'area_keyword',
        pathaoCityId: sorted[0].dist.defaultPathaoCityId,
      };
    }
    // Ambiguous match across multiple districts -> return null (uncertain) so user picks from dropdown
    return { district: null, confidence: 'uncertain' };
  }

  // Default Fallback: Check if city is "Inside Dhaka" or "Sub-Dhaka"
  if (normCity.includes('inside dhaka') || normCity.includes('sub-dhaka') || normCity.includes('sub dhaka')) {
    const dhakaDist = BANGLADESH_DISTRICTS.find((d) => d.name === 'Dhaka');
    return {
      district: 'Dhaka',
      confidence: 'medium',
      matchedBy: 'city_keyword',
      pathaoCityId: dhakaDist?.defaultPathaoCityId,
    };
  }

  // No confident match found
  return { district: null, confidence: 'uncertain' };
}

// Get all 64 district names for UI Dropdowns
export const ALL_DISTRICT_NAMES: string[] = BANGLADESH_DISTRICTS.map((d) => d.name).sort();
