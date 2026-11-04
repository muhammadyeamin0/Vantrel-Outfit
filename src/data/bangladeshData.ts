export interface DivisionData {
  name: string;
  districts: {
    name: string;
    isDhakaCity?: boolean;
    upazilas: string[];
  }[];
}

export const BANGLADESH_DIVISIONS: DivisionData[] = [
  {
    name: 'Dhaka',
    districts: [
      {
        name: 'Dhaka',
        isDhakaCity: true,
        upazilas: [
          'Dhanmondi',
          'Gulshan',
          'Banani',
          'Uttara',
          'Mirpur',
          'Mohammadpur',
          'Bashundhara R/A',
          'Badda',
          'Khilgaon',
          'Motijheel',
          'Old Dhaka (Sadarghat/Lalbagh)',
          'Tejgaon',
          'Rampura',
          'Malibagh',
          'Jatrabari',
          'Savar',
          'Keraniganj',
          'Dhamrai'
        ]
      },
      {
        name: 'Gazipur',
        upazilas: ['Gazipur Sadar', 'Tongi', 'Kaliakair', 'Kapasia', 'Sreepur']
      },
      {
        name: 'Narayanganj',
        upazilas: ['Narayanganj Sadar', 'Bandar', 'Araihazar', 'Rupganj', 'Sonargaon']
      },
      {
        name: 'Tangail',
        upazilas: ['Tangail Sadar', 'Mirzapur', 'Madhupur', 'Gopalpur', 'Sakhipur']
      },
      {
        name: 'Faridpur',
        upazilas: ['Faridpur Sadar', 'Boalmari', 'Bhanga', 'Madhukhali', 'Nagarkanda']
      },
      {
        name: 'Manikganj',
        upazilas: ['Manikganj Sadar', 'Singair', 'Saturia', 'Harirampur']
      },
      {
        name: 'Munshiganj',
        upazilas: ['Munshiganj Sadar', 'Sreenagar', 'Sirajdikhan', 'Lohajang']
      },
      {
        name: 'Narsingdi',
        upazilas: ['Narsingdi Sadar', 'Palash', 'Shibpur', 'Raipura', 'Belabo']
      },
      {
        name: 'Kishoreganj',
        upazilas: ['Kishoreganj Sadar', 'Bhairab', 'Bajitpur', 'Katiadi']
      },
      {
        name: 'Gopalganj',
        upazilas: ['Gopalganj Sadar', 'Kashiani', 'Kotalipara', 'Muksudpur', 'Tungipara']
      },
      {
        name: 'Madaripur',
        upazilas: ['Madaripur Sadar', 'Shibchar', 'Kalkini', 'Rajoir']
      },
      {
        name: 'Rajbari',
        upazilas: ['Rajbari Sadar', 'Goalanda', 'Pangsha', 'Baliakandi']
      },
      {
        name: 'Shariatpur',
        upazilas: ['Shariatpur Sadar', 'Naria', 'Zajira', 'Bhedarganj']
      }
    ]
  },
  {
    name: 'Chattogram',
    districts: [
      {
        name: 'Chattogram',
        upazilas: ['Agrabad', 'Nasirabad', 'Panchlaish', 'GEC', 'Halishahar', 'Kotwali', 'Hathazari', 'Sitakunda', 'Patiya']
      },
      {
        name: "Cox's Bazar",
        upazilas: ["Cox's Bazar Sadar", 'Ramu', 'Chakaria', 'Teknaf', 'Ukhia']
      },
      {
        name: 'Cumilla',
        upazilas: ['Cumilla Sadar', 'Laksam', 'Daudkandi', 'Debidwar', 'Chandina']
      },
      {
        name: 'Feni',
        upazilas: ['Feni Sadar', 'Daganbhuiyan', 'Chhagalnaiya', 'Parshuram']
      },
      {
        name: 'Noakhali',
        upazilas: ['Noakhali Sadar', 'Begumganj', 'Chatkhil', 'Companyganj', 'Senbagh']
      },
      {
        name: 'Brahmanbaria',
        upazilas: ['Brahmanbaria Sadar', 'Ashuganj', 'Sarail', 'Kasba', 'Nabinagar']
      },
      {
        name: 'Chandpur',
        upazilas: ['Chandpur Sadar', 'Hajiganj', 'Matlab', 'Faridganj']
      },
      {
        name: 'Lakshmipur',
        upazilas: ['Lakshmipur Sadar', 'Raipur', 'Ramganj', 'Ramgati']
      },
      {
        name: 'Rangamati',
        upazilas: ['Rangamati Sadar', 'Kaptai', 'Baghaichhari']
      },
      {
        name: 'Bandarban',
        upazilas: ['Bandarban Sadar', 'Ruma', 'Thanchi']
      },
      {
        name: 'Khagrachhari',
        upazilas: ['Khagrachhari Sadar', 'Dighinala', 'Ramgarh']
      }
    ]
  },
  {
    name: 'Sylhet',
    districts: [
      {
        name: 'Sylhet',
        upazilas: ['Sylhet Sadar', 'Zindabazar', 'Amberkhana', 'Beanibazar', 'Golapganj', 'Osmani Nagar']
      },
      {
        name: 'Moulvibazar',
        upazilas: ['Moulvibazar Sadar', 'Sreemangal', 'Kulaura', 'Kamalganj']
      },
      {
        name: 'Habiganj',
        upazilas: ['Habiganj Sadar', 'Madhabpur', 'Nabiganj', 'Bahubal']
      },
      {
        name: 'Sunamganj',
        upazilas: ['Sunamganj Sadar', 'Chhatak', 'Jagannathpur', 'Tahirpur']
      }
    ]
  },
  {
    name: 'Rajshahi',
    districts: [
      {
        name: 'Rajshahi',
        upazilas: ['Boalia', 'Motihar', 'Rajpara', 'Paba', 'Godagari', 'Bagha']
      },
      {
        name: 'Bogura',
        upazilas: ['Bogura Sadar', 'Sherpur', 'Shibganj', 'Gabtali', 'Sariakandi']
      },
      {
        name: 'Pabna',
        upazilas: ['Pabna Sadar', 'Ishwardi', 'Santhia', 'Bera', 'Chatmohar']
      },
      {
        name: 'Sirajganj',
        upazilas: ['Sirajganj Sadar', 'Ullapara', 'Shahjadpur', 'Belkuchi']
      },
      {
        name: 'Naogaon',
        upazilas: ['Naogaon Sadar', 'Patnitala', 'Manda', 'Badalgachhi']
      },
      {
        name: 'Natore',
        upazilas: ['Natore Sadar', 'Singra', 'Baraigram', 'Lalpur']
      },
      {
        name: 'Chapai Nawabganj',
        upazilas: ['Chapai Nawabganj Sadar', 'Shibganj', 'Bholahat']
      },
      {
        name: 'Joypurhat',
        upazilas: ['Joypurhat Sadar', 'Panchbibi', 'Kalai']
      }
    ]
  },
  {
    name: 'Khulna',
    districts: [
      {
        name: 'Khulna',
        upazilas: ['Khulna Sadar', 'Sonadanga', 'Khalishpur', 'Daulatpur', 'Dumuria', 'Rupsha']
      },
      {
        name: 'Jashore',
        upazilas: ['Jashore Sadar', 'Jhikargachha', 'Keshabpur', 'Manirampur', 'Sharsha']
      },
      {
        name: 'Kushtia',
        upazilas: ['Kushtia Sadar', 'Kumarkhali', 'Mirpur', 'Bheramara']
      },
      {
        name: 'Satkhira',
        upazilas: ['Satkhira Sadar', 'Kalaroa', 'Tala', 'Shyamnagar']
      },
      {
        name: 'Bagerhat',
        upazilas: ['Bagerhat Sadar', 'Mongla', 'Morrelganj']
      },
      {
        name: 'Chuadanga',
        upazilas: ['Chuadanga Sadar', 'Alamdanga', 'Damurhuda']
      },
      {
        name: 'Jhenaidah',
        upazilas: ['Jhenaidah Sadar', 'Kaliganj', 'Kotchandpur', 'Shailkupa']
      },
      {
        name: 'Magura',
        upazilas: ['Magura Sadar', 'Sreepur', 'Mohammadpur']
      },
      {
        name: 'Meherpur',
        upazilas: ['Meherpur Sadar', 'Gangni', 'Mujibnagar']
      },
      {
        name: 'Narail',
        upazilas: ['Narail Sadar', 'Lohagara', 'Kalia']
      }
    ]
  },
  {
    name: 'Barishal',
    districts: [
      {
        name: 'Barishal',
        upazilas: ['Barishal Sadar', 'Babuganj', 'Bakerganj', 'Gournadi', 'Banaripara']
      },
      {
        name: 'Bhola',
        upazilas: ['Bhola Sadar', 'Lalmohan', 'Char Fasson', 'Borhanuddin']
      },
      {
        name: 'Patuakhali',
        upazilas: ['Patuakhali Sadar', 'Galachipa', 'Kalapara', 'Bauphal']
      },
      {
        name: 'Pirojpur',
        upazilas: ['Pirojpur Sadar', 'Mathbaria', 'Bhandaria', 'Nesarabad']
      },
      {
        name: 'Barguna',
        upazilas: ['Barguna Sadar', 'Amtali', 'Patharghata']
      },
      {
        name: 'Jhalokati',
        upazilas: ['Jhalokati Sadar', 'Nalchhiti', 'Rajapur']
      }
    ]
  },
  {
    name: 'Rangpur',
    districts: [
      {
        name: 'Rangpur',
        upazilas: ['Rangpur Sadar', 'Badarganj', 'Pirganj', 'Mithapukur', 'Kaunia']
      },
      {
        name: 'Dinajpur',
        upazilas: ['Dinajpur Sadar', 'Birganj', 'Parbatipur', 'Phulbari']
      },
      {
        name: 'Kurigram',
        upazilas: ['Kurigram Sadar', 'Nageshwari', 'Ulipur', 'Rajarhat']
      },
      {
        name: 'Gaibandha',
        upazilas: ['Gaibandha Sadar', 'Gobindaganj', 'Palashbari', 'Sundarganj']
      },
      {
        name: 'Nilphamari',
        upazilas: ['Nilphamari Sadar', 'Saidpur', 'Domar', 'Jaldhaka']
      },
      {
        name: 'Panchagarh',
        upazilas: ['Panchagarh Sadar', 'Tetulia', 'Boda', 'Atwari']
      },
      {
        name: 'Thakurgaon',
        upazilas: ['Thakurgaon Sadar', 'Pirganj', 'Ranisankail']
      },
      {
        name: 'Lalmonirhat',
        upazilas: ['Lalmonirhat Sadar', 'Patgram', 'Hatibandha']
      }
    ]
  },
  {
    name: 'Mymensingh',
    districts: [
      {
        name: 'Mymensingh',
        upazilas: ['Mymensingh Sadar', 'Trishal', 'Bhaluka', 'Muktagachha', 'Gafargaon', 'Ishwarganj']
      },
      {
        name: 'Jamalpur',
        upazilas: ['Jamalpur Sadar', 'Sarishabari', 'Islampur', 'Melandaha']
      },
      {
        name: 'Netrokona',
        upazilas: ['Netrokona Sadar', 'Kendua', 'Durgapur', 'Mohanganj']
      },
      {
        name: 'Sherpur',
        upazilas: ['Sherpur Sadar', 'Nalitabari', 'Nakla', 'Sreebardi']
      }
    ]
  }
];
