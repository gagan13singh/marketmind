/**
 * The full NSE cash-market universe.
 *
 * Every symbol that traded in the EQ / BE / BZ / SM / ST series on at least
 * three sessions of a recent sample of NSE bhavcopy files. That is the
 * definition of "listed and actually tradeable", and it is why this list is
 * ~3,150 names rather than the ~110 large caps the first version shipped with.
 *
 * Rows are packed as `SYMBOL|Name|Sector|kind|medianTurnoverLacs` and parsed
 * once on first use. Packing rather than emitting 3,150 object literals keeps
 * the source file readable, the parse fast, and the module small.
 *
 * Ordering is by median daily turnover, descending. Index 0 is the most liquid
 * name on the exchange. Several features rely on that ordering, so do not
 * re-sort this file.
 *
 * SERVER ONLY. This module is roughly 120 KB and must never reach the browser
 * bundle — client components import from `./symbols` instead.
 */

export type SymbolKind = "equity" | "etf" | "sme";

export interface UniverseEntry {
  symbol: string;
  /** Symbol without the `.NS` suffix, e.g. `RELIANCE`. */
  ticker: string;
  name: string;
  sector: string;
  kind: SymbolKind;
  /** Median daily turnover in ₹ lakhs — the liquidity ranking key. */
  turnoverLacs: number;
}

const PACKED = `
RELIANCE|Reliance Industries|Energy|equity|146223
HDFCBANK|HDFC Bank|Banking|equity|144550
INFY|Infosys|IT|equity|127401
ICICIBANK|ICICI Bank|Banking|equity|112272
BSE|BSE|Capital Markets|equity|100841
BHARTIARTL|Bharti Airtel|Telecom|equity|98154
ETERNAL|Eternal (Zomato)|Consumer Tech|equity|84459
TCS|Tata Consultancy Services|IT|equity|84049
SBIN|State Bank of India|Banking|equity|74508
M&M|Mahindra & Mahindra|Automobile|equity|68715
AXISBANK|Axis Bank|Banking|equity|67031
BAJFINANCE|Bajaj Finance|Financial Services|equity|60227
DIXON|Dixon Technologies India|Consumer Durables|equity|59050
TMCV|Tata Motors Commercial Vehicles|Automobile|equity|58113
BEL|Bharat Electronics|Defence|equity|57069
KOTAKBANK|Kotak Mahindra Bank|Banking|equity|53775
TATAMOTORS|Tata Motors|Automobile|equity|52978
LT|Larsen & Toubro|Infrastructure|equity|52125
WAAREEENER|Waaree Energies|Power|equity|51854
TRENT|Trent|Retail|equity|51012
CDSL|Central Depository Services India|Capital Markets|equity|47475
JIOFIN|Jio Financial Services|Financial Services|equity|47001
INDIGO|InterGlobe Aviation (IndiGo)|Aviation|equity|46882
PAYTM|One 97 Communications (Paytm)|Consumer Tech|equity|45406
HAL|Hindustan Aeronautics|Defence|equity|45365
MCX|Multi Commodity Exchange of India|Capital Markets|equity|45026
MAZDOCK|Mazagon Dock Shipbuilders|Defence|equity|44821
HCLTECH|HCL Technologies|IT|equity|41648
GROWW|Groww|Capital Markets|equity|40978
ITC|ITC|FMCG|equity|40900
SWIGGY|Swiggy|Consumer Tech|equity|38982
LIQUIDBEES|Nippon India ETF Nifty 1D Rate Liquid BeES|ETF|etf|36211
TATASTEEL|Tata Steel|Metals|equity|34176
SHRIRAMFIN|Shriram Finance|Financial Services|equity|33718
TMPV|Tata Motors Passenger Vehicles|Automobile|equity|32665
NTPC|NTPC|Power|equity|32444
MARUTI|Maruti Suzuki India|Automobile|equity|32374
INDUSINDBK|IndusInd Bank|Banking|equity|32144
COFORGE|Coforge|IT|equity|32131
SUZLON|Suzlon Energy|Power|equity|31723
HINDALCO|Hindalco Industries|Metals|equity|29853
BDL|Bharat Dynamics|Defence|equity|29150
BHARATCOAL|Bharat Coking Coal|Mining|equity|28584
RECLTD|REC|Financial Services|equity|28455
VBL|Varun Beverages|FMCG|equity|28410
APOLLOHOSP|Apollo Hospitals Enterprise|Healthcare|equity|28201
IDEA|Vodafone Idea|Telecom|equity|27342
SUNPHARMA|Sun Pharmaceutical Industries|Pharma|equity|27002
RBLBANK|RBL Bank|Banking|equity|26737
HINDUNILVR|Hindustan Unilever|FMCG|equity|26729
ULTRACEMCO|UltraTech Cement|Cement|equity|26614
TECHM|Tech Mahindra|IT|equity|25864
GRSE|Garden Reach Shipbuilders & Engineers|Defence|equity|25706
POWERGRID|Power Grid Corporation of India|Power|equity|25539
CHOLAFIN|Cholamandalam Investment & Finance|Financial Services|equity|25502
CANBK|Canara Bank|Banking|equity|25280
BAJAJ-AUTO|Bajaj Auto|Automobile|equity|25058
MAXHEALTH|Max Healthcare Institute|Healthcare|equity|24361
KAYNES|Kaynes Technology India|Consumer Durables|equity|24348
AMBER|Amber Enterprises India|Consumer Durables|equity|24327
VEDL|Vedanta|Metals|equity|24200
HEROMOTOCO|Hero MotoCorp|Automobile|equity|23600
KALYANKJIL|Kalyan Jewellers India|Retail|equity|23557
TVSMOTOR|TVS Motor Company|Automobile|equity|23023
SOLARINDS|Solar Industries India|Defence|equity|22728
INDUSTOWER|Indus Towers|Telecom|equity|22652
VMM|Vishal Mega Mart|Retail|equity|22592
POWERINDIA|Hitachi Energy India|Capital Goods|equity|22571
ASIANPAINT|Asian Paints|Paints|equity|22272
PERSISTENT|Persistent Systems|IT|equity|22209
TITAN|Titan Company|Consumer Durables|equity|22090
NAUKRI|Info Edge India|Consumer Tech|equity|21767
ADANIPOWER|Adani Power|Power|equity|21513
WIPRO|Wipro|IT|equity|21395
GAIL|GAIL India|Energy|equity|21280
PFC|Power Finance Corporation|Financial Services|equity|20997
DIVISLAB|Divi's Laboratories|Pharma|equity|20750
POLYCAB|Polycab India|Capital Goods|equity|20657
DLF|DLF|Real Estate|equity|20608
POLICYBZR|PB Fintech|Insurance|equity|20524
TATAPOWER|Tata Power|Power|equity|20431
BAJAJFINSV|Bajaj Finserv|Financial Services|equity|20292
EICHERMOT|Eicher Motors|Automobile|equity|20238
HDFCAMC|HDFC Asset Management|Capital Markets|equity|20098
DRREDDY|Dr Reddy's Laboratories|Pharma|equity|20053
ANGELONE|Angel One|Capital Markets|equity|19832
CIPLA|Cipla|Pharma|equity|19576
BPCL|Bharat Petroleum Corporation|Energy|equity|19489
HINDPETRO|Hindustan Petroleum Corporation|Energy|equity|19374
FORCEMOT|Force Motors|Automobile|equity|19317
ENRIN|Energy Infrastructure Trust|Power|equity|18885
ADANIGREEN|Adani Green Energy|Power|equity|18854
COALINDIA|Coal India|Mining|equity|18627
INDHOTEL|The Indian Hotels Company|Hospitality|equity|18597
COCHINSHIP|Cochin Shipyard|Defence|equity|18474
GLENMARK|Glenmark Pharmaceuticals|Pharma|equity|18469
LUPIN|Lupin|Pharma|equity|18307
ONGC|Oil & Natural Gas Corporation|Energy|equity|18234
BANKBARODA|Bank of Baroda|Banking|equity|18185
LAURUSLABS|Laurus Labs|Pharma|equity|18152
CUMMINSIND|Cummins India|Capital Goods|equity|17905
JSWENERGY|JSW Energy|Power|equity|17878
OLAELEC|Ola Electric Mobility|Automobile|equity|17696
PNB|Punjab National Bank|Banking|equity|17670
AUBANK|AU Small Finance Bank|Banking|equity|17363
GODREJPROP|Godrej Properties|Real Estate|equity|17254
ADANIPORTS|Adani Ports & SEZ|Infrastructure|equity|16931
GODFRYPHLP|Godfrey Phillips India|FMCG|equity|16879
HDFCLIFE|HDFC Life Insurance|Insurance|equity|16811
CGPOWER|CG Power & Industrial Solutions|Capital Goods|equity|16615
GRASIM|Grasim Industries|Cement|equity|16534
ADANIENT|Adani Enterprises|Conglomerate|equity|16303
JSWSTEEL|JSW Steel|Metals|equity|16300
DMART|Avenue Supermarts|Retail|equity|16171
HDBFS|HDB Financial Services|Financial Services|equity|16077
IOC|Indian Oil Corporation|Energy|equity|15946
UNIONBANK|Union Bank of India|Banking|equity|15794
ADANIENSOL|Adani Energy Solutions|Power|equity|15713
FORTIS|Fortis Healthcare|Healthcare|equity|15575
NMDC|NMDC|Mining|equity|15480
ZEEL|Zee Entertainment Enterprises|Media|equity|15317
SBILIFE|SBI Life Insurance|Insurance|equity|15257
UPL|UPL|Chemicals|equity|15246
BIOCON|Biocon|Pharma|equity|14939
ABB|ABB India|Capital Goods|equity|14745
JINDALSTEL|Jindal Steel|Metals|equity|14721
BEML|BEML|Defence|equity|14623
APLAPOLLO|APL Apollo Tubes|Metals|equity|14568
TORNTPHARM|Torrent Pharmaceuticals|Pharma|equity|14309
BRITANNIA|Britannia Industries|FMCG|equity|14183
UNITDSPR|United Spirits|FMCG|equity|14168
SAIL|Steel Authority of India|Metals|equity|14060
MANKIND|Mankind Pharma|Pharma|equity|13991
BHEL|Bharat Heavy Electricals|Capital Goods|equity|13829
LODHA|Lodha Developers|Real Estate|equity|13774
FEDERALBNK|Federal Bank|Banking|equity|13753
IDFCFIRSTB|IDFC First Bank|Banking|equity|13622
IEX|Indian Energy Exchange|Capital Markets|equity|13580
BOSCHLTD|Bosch|Auto Ancillary|equity|13552
HINDCOPPER|Hindustan Copper|Metals|equity|13388
PRESTIGE|Prestige Estates Projects|Real Estate|equity|13373
NATIONALUM|National Aluminium Company|Metals|equity|13213
MOTHERSON|Samvardhana Motherson International|Auto Ancillary|equity|13174
NIFTYBEES|Nippon India ETF Nifty 50 BeES|ETF|etf|13086
HAVELLS|Havells India|Consumer Durables|equity|13017
PGEL|PG Electroplast|Consumer Durables|equity|13002
LTF|L&T Finance|Financial Services|equity|12917
RVNL|Rail Vikas Nigam|Infrastructure|equity|12841
LGEINDIA|LG Electronics India|Consumer Durables|equity|12814
BELRISE|Belrise Industries|Auto Ancillary|equity|12770
ASHOKLEY|Ashok Leyland|Automobile|equity|12644
SILVERBEES|Nippon India Silver ETF|ETF|etf|12605
HYUNDAI|Hyundai Motor India|Automobile|equity|12513
NESTLEIND|Nestle India|FMCG|equity|12375
ICICIAMC|ICICI Prudential Asset Management|Capital Markets|equity|12228
SRF|SRF|Chemicals|equity|11986
IRFC|Indian Railway Finance Corporation|Financial Services|equity|11944
MARICO|Marico|FMCG|equity|11892
BANDHANBNK|Bandhan Bank|Banking|equity|11856
VOLTAS|Voltas|Consumer Durables|equity|11830
YESBANK|Yes Bank|Banking|equity|11815
COLPAL|Colgate-Palmolive India|FMCG|equity|11713
AMBUJACEM|Ambuja Cements|Cement|equity|11702
PATANJALI|Patanjali Foods|FMCG|equity|11685
GVT&D|GE Vernova T&D India|Capital Goods|equity|11679
JPPOWER|Jaiprakash Power Ventures|Power|equity|11629
SIEMENS|Siemens|Capital Goods|equity|11615
CAMS|Computer Age Management Services|Capital Markets|equity|11551
TRANSRAILL|Transrail Lighting|Infrastructure|equity|11480
INDIANB|Indian Bank|Banking|equity|11379
GODREJCP|Godrej Consumer Products|FMCG|equity|11364
BHARATFORG|Bharat Forge|Auto Ancillary|equity|11363
MPHASIS|Mphasis|IT|equity|11268
ANANTRAJ|Anant Raj|Real Estate|equity|11208
DABUR|Dabur India|FMCG|equity|11172
MANAPPURAM|Manappuram Finance|Financial Services|equity|11097
DELHIVERY|Delhivery|Logistics|equity|11053
NUVAMA|Nuvama Wealth Management|Capital Markets|equity|11003
GOLDBEES|Nippon India ETF Gold BeES|ETF|etf|10987
MFSL|Max Financial Services|Insurance|equity|10892
SAMMAANCAP|Sammaan Capital|Financial Services|equity|10864
KEI|KEI Industries|Capital Goods|equity|10858
SYRMA|Syrma SGS Technology|Consumer Durables|equity|10781
LTIM|LTIMindtree|IT|equity|10703
TATACONSUM|Tata Consumer Products|FMCG|equity|10683
PNBHOUSING|PNB Housing Finance|Financial Services|equity|10649
LIQUIDCASE|Mirae Asset Nifty 1D Rate Liquid ETF|ETF|etf|10553
KFINTECH|KFin Technologies|Capital Markets|equity|10476
SAGILITY|Sagility India|IT|equity|10463
PREMIERENE|Premier Energies|Power|equity|10408
COROMANDEL|Coromandel International|Chemicals|equity|10290
TENNIND|Tenneco Clean Air India|Auto Ancillary|equity|10217
MUTHOOTFIN|Muthoot Finance|Financial Services|equity|10205
ICICIGI|ICICI Lombard General Insurance|Insurance|equity|10191
BLUESTARCO|Blue Star|Consumer Durables|equity|10170
SONACOMS|Sona BLW Precision Forgings|Auto Ancillary|equity|10097
PAGEIND|Page Industries|Textiles|equity|10067
AUROPHARMA|Aurobindo Pharma|Pharma|equity|9988
TATACAP|Tata Capital|Financial Services|equity|9945
GMDCLTD|Gujarat Mineral Development Corporation|Mining|equity|9903
CHENNPETRO|Chennai Petroleum Corporation|Energy|equity|9865
MOTILALOFS|Motilal Oswal Financial Services|Capital Markets|equity|9777
NYKAA|FSN E-Commerce Ventures (Nykaa)|Consumer Tech|equity|9762
HINDZINC|Hindustan Zinc|Metals|equity|9735
RTNPOWER|RattanIndia Power|Power|equity|9692
TITAGARH|Titagarh Rail Systems|Capital Goods|equity|9581
ABCAPITAL|Aditya Birla Capital|Financial Services|equity|9529
WOCKPHARMA|Wockhardt|Pharma|equity|9440
IREDA|Indian Renewable Energy Development Agency|Financial Services|equity|9368
PCJEWELLER|PC Jeweller|Retail|equity|9220
GMRAIRPORT|GMR Airports|Infrastructure|equity|9192
JMFINANCIL|JM Financial|Financial Services|equity|9177
OBEROIRLTY|Oberoi Realty|Real Estate|equity|9119
KPITTECH|KPIT Technologies|IT|equity|9084
MRF|MRF|Auto Ancillary|equity|8953
OIL|Oil India|Energy|equity|8917
OFSS|Oracle Financial Services Software|IT|equity|8742
BANKINDIA|Bank of India|Banking|equity|8735
IIFL|IIFL Finance|Financial Services|equity|8696
RPOWER|Reliance Power|Power|equity|8674
QPOWER|Quality Power Electrical Equipments|Capital Goods|equity|8380
TIINDIA|Tube Investments of India|Auto Ancillary|equity|8368
LICHSGFIN|LIC Housing Finance|Financial Services|equity|8203
NBCC|NBCC India|Infrastructure|equity|8182
ZYDUSLIFE|Zydus Lifesciences|Pharma|equity|8182
360ONE|360 ONE WAM|Financial Services|equity|8116
ACC|ACC|Cement|equity|8031
INOXWIND|Inox Wind|Power|equity|7999
ASTRAL|Astral|Building Materials|equity|7950
ANTHEM|Anthem Biosciences|Pharma|equity|7940
BALKRISIND|Balkrishna Industries|Auto Ancillary|equity|7910
DALBHARAT|Dalmia Bharat|Cement|equity|7851
EXIDEIND|Exide Industries|Auto Ancillary|equity|7737
NATCOPHARM|Natco Pharma|Pharma|equity|7724
MEESHO|Meesho|Consumer Tech|equity|7628
PHOENIXLTD|The Phoenix Mills|Real Estate|equity|7589
OSWALPUMPS|Oswal Pumps|Capital Goods|equity|7562
NH|Narayana Hrudayalaya|Healthcare|equity|7525
PARADEEP|Paradeep Phosphates|Chemicals|equity|7431
LOTUSDEV|Lotus Developers|Real Estate|equity|7408
LIQUIDIETF|ICICI Prudential Nifty 1D Rate Liquid ETF|ETF|etf|7399
CONCOR|Container Corporation of India|Logistics|equity|7395
NHPC|NHPC|Power|equity|7393
SBICARD|SBI Cards & Payment Services|Financial Services|equity|7376
HUDCO|Housing & Urban Development Corporation|Financial Services|equity|7342
CARTRADE|CarTrade Tech|Consumer Tech|equity|7327
NAZARA|Nazara Technologies|Consumer Tech|equity|7314
PPLPHARMA|Piramal Pharma|Pharma|equity|7294
APOLLO|Apollo Micro Systems|Defence|equity|7285
CHAMBLFERT|Chambal Fertilisers & Chemicals|Chemicals|equity|7206
TATAELXSI|Tata Elxsi|IT|equity|7195
LICI|Life Insurance Corporation of India|Insurance|equity|7190
SHREECEM|Shree Cement|Cement|equity|7189
DATAPATTNS|Data Patterns India|Defence|equity|7150
PIDILITIND|Pidilite Industries|Chemicals|equity|7145
SWANENERGY|Swan Energy|Energy|equity|7119
NEULANDLAB|Neuland Laboratories|Pharma|equity|7035
SAMBHV|Sambhv Steel Tubes|Metals|equity|7007
PETRONET|Petronet LNG|Energy|equity|6890
JKCEMENT|JK Cement|Cement|equity|6734
RELINFRA|Reliance Infrastructure|Infrastructure|equity|6644
SYNGENE|Syngene International|Pharma|equity|6611
RADICO|Radico Khaitan|FMCG|equity|6603
LENSKART|Lenskart Solutions|Consumer Tech|equity|6536
EIEL|Epack Durable|Consumer Durables|equity|6521
SUPREMEIND|Supreme Industries|Building Materials|equity|6421
TATATECH|Tata Technologies|IT|equity|6399
SWSOLAR|Sterling & Wilson Renewable Energy|Power|equity|6355
PEL|Piramal Enterprises|Financial Services|equity|6347
CUPID|Cupid|Healthcare|equity|6345
JUBLFOOD|Jubilant FoodWorks|FMCG|equity|6276
URBANCO|Urban Company|Consumer Tech|equity|6259
LIQUIDADD|Aditya Birla Sun Life Nifty 1D Rate Liquid ETF|ETF|etf|6250
PWL|Precision Wires India|Capital Goods|equity|6232
SMLISUZU|SML Isuzu|Automobile|equity|6205
IDBI|IDBI Bank|Banking|equity|6153
CGCL|Capri Global Capital|Financial Services|equity|6055
UNOMINDA|UNO Minda|Auto Ancillary|equity|5967
ITCHOTELS|ITC Hotels|Hospitality|equity|5868
APARINDS|Apar Industries|Capital Goods|equity|5815
NAM-INDIA|Nippon Life India Asset Management|Capital Markets|equity|5802
POONAWALLA|Poonawalla Fincorp|Financial Services|equity|5796
IGL|Indraprastha Gas|Energy|equity|5780
JSL|Jindal Stainless|Metals|equity|5758
BAJAJHLDNG|Bajaj Holdings & Investment|Financial Services|equity|5735
HFCL|HFCL|Telecom|equity|5706
IXIGO|Le Travenues Technology (ixigo)|Consumer Tech|equity|5649
CROMPTON|Crompton Greaves Consumer Electricals|Consumer Durables|equity|5640
MAHABANK|Bank of Maharashtra|Banking|equity|5640
PIIND|PI Industries|Chemicals|equity|5604
ENGINERSIN|Engineers India|Infrastructure|equity|5577
REDINGTON|Redington|Services|equity|5574
CRIZAC|Crizac|Services|equity|5567
KARURVYSYA|Karur Vysya Bank|Banking|equity|5567
MGL|Mahanagar Gas|Energy|equity|5503
NTPCGREEN|NTPC Green Energy|Power|equity|5500
HSCL|Himadri Speciality Chemical|Chemicals|equity|5493
JAYNECOIND|Jayaswal Neco Industries|Metals|equity|5480
JBCHEPHARM|J.B. Chemicals & Pharmaceuticals|Pharma|equity|5420
NCC|NCC|Infrastructure|equity|5388
ZENTEC|Zen Technologies|Defence|equity|5356
IRCTC|Indian Railway Catering & Tourism Corporation|Services|equity|5315
OLECTRA|Olectra Greentech|Automobile|equity|5167
M&MFIN|Mahindra & Mahindra Financial Services|Financial Services|equity|5141
TI|Tilaknagar Industries|FMCG|equity|5140
SMLMAH|SML Mahindra|Automobile|equity|5032
HBLENGINE|HBL Engineering|Capital Goods|equity|5013
NAVINFLUOR|Navin Fluorine International|Chemicals|equity|4998
ICICIPRULI|ICICI Prudential Life Insurance|Insurance|equity|4984
RAILTEL|RailTel Corporation of India|Infrastructure|equity|4953
KPRMILL|K.P.R. Mill|Textiles|equity|4953
ARE&M|Amara Raja Energy & Mobility|Auto Ancillary|equity|4947
BAJAJHFL|Bajaj Housing Finance|Financial Services|equity|4935
HOMEFIRST|Home First Finance|Financial Services|equity|4913
GLAND|Gland Pharma|Pharma|equity|4891
EDELWEISS|Edelweiss Financial Services|Financial Services|equity|4871
PARAS|Paras Defence & Space Technologies|Defence|equity|4871
IRCON|Ircon International|Infrastructure|equity|4862
TATACHEM|Tata Chemicals|Chemicals|equity|4796
ALKEM|Alkem Laboratories|Pharma|equity|4779
STLTECH|Sterlite Technologies|Telecom|equity|4776
NETWEB|Netweb Technologies India|IT|equity|4756
LLOYDSME|Lloyds Metals & Energy|Metals|equity|4719
FIVESTAR|Five-Star Business Finance|Financial Services|equity|4689
MRPL|Mangalore Refinery & Petrochemicals|Energy|equity|4663
BLS|BLS International Services|Services|equity|4639
ABFRL|Aditya Birla Fashion & Retail|Retail|equity|4630
TATACOMM|Tata Communications|Telecom|equity|4628
AARTIIND|Aarti Industries|Chemicals|equity|4624
KRN|KRN Heat Exchanger & Refrigeration|Capital Goods|equity|4622
DEEPAKFERT|Deepak Fertilisers & Petrochemicals|Chemicals|equity|4606
PIRAMALFIN|Piramal Finance|Financial Services|equity|4598
SWANCORP|Swan Corp|Energy|equity|4512
AIIL|Authum Investment & Infrastructure|Financial Services|equity|4482
SHANTIGOLD|Shanti Gold International|Retail|equity|4480
HEXT|Hexaware Technologies|IT|equity|4453
WELCORP|Welspun Corp|Metals|equity|4450
TORNTPOWER|Torrent Power|Power|equity|4439
MBEL|Mangal Electrical Industries|Capital Goods|equity|4412
TFCILTD|Tourism Finance Corporation of India|Financial Services|equity|4386
KAJARIACER|Kajaria Ceramics|Building Materials|equity|4385
CESC|CESC|Power|equity|4375
BHARTIHEXA|Bharti Hexacom|Telecom|equity|4372
ASTERDM|Aster DM Healthcare|Healthcare|equity|4335
BSOFT|BirlaSoft|IT|equity|4305
KPIGREEN|KPI Green Energy|Power|equity|4304
TRAVELFOOD|Travel Food Services|FMCG|equity|4273
ANANDRATHI|Anand Rathi Wealth|Capital Markets|equity|4206
SJVN|SJVN|Power|equity|4177
ACUTAAS|Acutaas Chemicals|Chemicals|equity|4170
DIACABS|Diamond Power Infrastructure|Capital Goods|equity|4151
SHREEJISPG|Shreeji Shipping Global|Logistics|equity|4131
LTFOODS|LT Foods|FMCG|equity|4101
CHOLAHLDNG|Cholamandalam Financial Holdings|Financial Services|equity|4070
CPPLUS|Aditya Infotech|Consumer Durables|equity|4050
SILVERBETA|Silver ETF|ETF|etf|4048
CHOICEIN|Choice International|Capital Markets|equity|4037
TARIL|Transformers & Rectifiers India|Capital Goods|equity|4024
EMBDL|Embassy Developments|Real Estate|equity|4018
GRANULES|Granules India|Pharma|equity|4009
WABAG|VA Tech Wabag|Industrials|equity|3993
GABRIEL|Gabriel India|Auto Ancillary|equity|3975
TEJASNET|Tejas Networks|Telecom|equity|3925
NORTHARC|Northern Arc Capital|Financial Services|equity|3918
AFFLE|Affle 3i|IT|equity|3885
GRAPHITE|Graphite India|Metals|equity|3852
BLUEJET|Blue Jet Healthcare|Pharma|equity|3825
CREDITACC|CreditAccess Grameen|Financial Services|equity|3819
RAMCOCEM|The Ramco Cements|Cement|equity|3798
MOBIKWIK|One MobiKwik Systems|Consumer Tech|equity|3797
APTUS|Aptus Value Housing Finance|Financial Services|equity|3797
SOBHA|Sobha|Real Estate|equity|3794
TRITURBINE|Triveni Turbine|Capital Goods|equity|3792
AMAGI|Amagi Media Labs|Consumer Tech|equity|3785
SHRINGARMS|Shringar House of Mangalsutra|Retail|equity|3781
TIMETECHNO|Time Technoplast|Industrials|equity|3769
POCL|Pondy Oxides & Chemicals|Metals|equity|3734
JSWINFRA|JSW Infrastructure|Infrastructure|equity|3733
ITDCEM|ITD Cementation India|Infrastructure|equity|3728
CYIENT|Cyient|IT|equity|3720
RKFORGE|Ramkrishna Forgings|Auto Ancillary|equity|3697
ELLEN|Ellenbarrie Industrial Gases|Chemicals|equity|3685
JAINREC|Jain Resource Recycling|Metals|equity|3658
PINELABS|Pine Labs|Consumer Tech|equity|3640
IRB|IRB Infrastructure Developers|Infrastructure|equity|3636
STAR|Strides Pharma Science|Pharma|equity|3634
UJJIVANSFB|Ujjivan Small Finance Bank|Banking|equity|3632
HUBTOWN|Hubtown|Real Estate|equity|3630
SAILIFE|Sai Life Sciences|Pharma|equity|3629
LALPATHLAB|Dr Lal PathLabs|Healthcare|equity|3626
SHAKTIPUMP|Shakti Pumps India|Capital Goods|equity|3606
CEATLTD|CEAT|Auto Ancillary|equity|3593
SILVERIETF|ICICI Prudential Silver ETF|ETF|etf|3544
PROSTARM|Prostarm Info Systems|Capital Goods|equity|3522
ATGL|Adani Total Gas|Energy|equity|3496
GRAVITA|Gravita India|Metals|equity|3489
LIQUIDBETF|Bajaj Finserv Nifty 1D Rate Liquid ETF|ETF|etf|3476
LIQUID1|Nifty 1D Rate Liquid ETF|ETF|etf|3472
PCBL|PCBL Chemical|Chemicals|equity|3449
SIGNATURE|Signatureglobal India|Real Estate|equity|3425
NEWGEN|Newgen Software Technologies|IT|equity|3397
AFCONS|Afcons Infrastructure|Infrastructure|equity|3391
TDPOWERSYS|TD Power Systems|Capital Goods|equity|3388
SCI|Shipping Corporation of India|Logistics|equity|3346
SKYGOLD|Sky Gold & Diamonds|Retail|equity|3323
FIRSTCRY|Brainbees Solutions (FirstCry)|Consumer Tech|equity|3284
KIMS|Krishna Institute of Medical Sciences|Healthcare|equity|3283
HEG|HEG|Metals|equity|3283
ONESOURCE|OneSource Specialty Pharma|Pharma|equity|3249
THERMAX|Thermax|Capital Goods|equity|3240
ASTRAMICRO|Astra Microwave Products|Defence|equity|3220
CUB|City Union Bank|Banking|equity|3218
MAMATA|Mamata Machinery|Capital Goods|equity|3211
KEC|KEC International|Infrastructure|equity|3207
CASTROLIND|Castrol India|Energy|equity|3193
AEROFLEX|Aeroflex Industries|Capital Goods|equity|3191
AVANTIFEED|Avanti Feeds|FMCG|equity|3191
AWL|AWL Agri Business|FMCG|equity|3176
JYOTICNC|Jyoti CNC Automation|Capital Goods|equity|3168
LLOYDSENGG|Lloyds Engineering Works|Capital Goods|equity|3157
BRIGADE|Brigade Enterprises|Real Estate|equity|3117
ZENSARTECH|Zensar Technologies|IT|equity|3114
KIRLOSBROS|Kirloskar Brothers|Capital Goods|equity|3108
EBGNG|Ebgng|Other|equity|3092
WELSPUNLIV|Welspun Living|Textiles|equity|3090
IKS|Inventurus Knowledge Solutions|IT|equity|3050
IFCI|IFCI|Financial Services|equity|3027
INTELLECT|Intellect Design Arena|IT|equity|2995
J&KBANK|Jammu & Kashmir Bank|Banking|equity|2981
AJANTPHARM|Ajanta Pharma|Pharma|equity|2976
LEMONTREE|Lemon Tree Hotels|Hospitality|equity|2964
ATHERENERG|Ather Energy|Automobile|equity|2962
JINDALSAW|Jindal Saw|Metals|equity|2952
TANLA|Tanla Platforms|IT|equity|2882
WHIRLPOOL|Whirlpool of India|Consumer Durables|equity|2879
ARSSBL|ARSS Infrastructure Projects|Infrastructure|equity|2873
GENUSPOWER|Genus Power Infrastructures|Power|equity|2872
CRAFTSMAN|Craftsman Automation|Auto Ancillary|equity|2830
GESHIP|The Great Eastern Shipping Company|Logistics|equity|2820
TEGA|Tega Industries|Capital Goods|equity|2820
ABLBL|Aditya Birla Lifestyle Brands|Retail|equity|2818
FSL|Firstsource Solutions|IT|equity|2814
LLOYDSENT|Lloyds Enterprises|Metals|equity|2813
MEDANTA|Global Health (Medanta)|Healthcare|equity|2804
SUNDARMFIN|Sundaram Finance|Financial Services|equity|2801
RAYMOND|Raymond|Textiles|equity|2796
AADHARHFC|Aadhar Housing Finance|Financial Services|equity|2795
PRIVISCL|Privi Speciality Chemicals|Chemicals|equity|2776
NAVA|NAVA|Power|equity|2766
SHARDACROP|Sharda Cropchem|Chemicals|equity|2756
SOUTHBANK|South Indian Bank|Banking|equity|2745
JUBLINGREA|Jublingrea|Other|equity|2731
INDIAMART|Indiamart|Other|equity|2730
ECLERX|eClerx Services|IT|equity|2703
WENDT|Wendt (india)|Capital Goods|equity|2696
EIDPARRY|E.i.d.-parry (india)|FMCG|equity|2691
RELIGARE|Religare Enterprises|Financial Services|equity|2687
PFOCUS|Prime Focus|Media|equity|2679
SILVERAG|Silverag|Other|equity|2671
ASHAPURMIN|Ashapura Minechem|Metals|equity|2663
KIRLOSENG|Kirloskar OIL Engines|Auto Ancillary|equity|2655
PROTEAN|Protean|Other|equity|2649
FLUOROCHEM|Fluorochem|Other|equity|2635
PVRINOX|PVR INOX|Media|equity|2633
NLCINDIA|Nlcindia|Other|equity|2628
SAMHI|Samhi|Other|equity|2627
EMMVEE|Emmvee|Other|equity|2627
TIMKEN|Timken India|Capital Goods|equity|2619
ABSLAMC|Abslamc|Other|equity|2617
SIGACHI|Sigachi|Other|equity|2600
ITBEES|Nippon India ETF Nifty IT|ETF|etf|2587
VINCOFE|Vincofe|Other|equity|2574
APOLLOTYRE|Apollo Tyres|Auto Ancillary|equity|2563
LTTS|Ltts|Other|equity|2557
DATAMATICS|Datamatics Global Services|IT|equity|2543
LAXMIINDIA|Laxmiindia|Other|equity|2541
SBFC|Sbfc|Other|equity|2536
AEGISVOPAK|Aegis Vopak Terminals|Energy|equity|2534
BLACKBUCK|Blackbuck|Other|equity|2534
RALLIS|Rallis India|FMCG|equity|2528
SHYAMMETL|Shyam Metalics & Energy|Metals|equity|2515
POLYMED|Poly Medicure|Healthcare|equity|2502
NETWORK18|Network18 Media & Investments|Financial Services|equity|2502
YATHARTH|Yatharth|Other|equity|2501
GILLETTE|Gillette India|FMCG|equity|2498
GLAXO|GlaxoSmithKline Pharmaceuticals|Pharma|equity|2478
BANKBEES|Nippon India ETF Nifty Bank BeES|ETF|etf|2467
SONATSOFTW|Sonata Software|IT|equity|2466
ACMESOLAR|Acmesolar|Other|equity|2461
GRMOVER|GRM Overseas|Other|equity|2459
JUBLPHARMA|Jublpharma|Other|equity|2449
PTC|PTC India|Power|equity|2438
VIKRAMSOLR|Vikramsolr|Other|equity|2417
MARKSANS|Marksans Pharma|Pharma|equity|2408
IGIL|Igil|Other|equity|2397
AAVAS|Aavas|Other|equity|2395
ESCORTS|Escorts Kubota|Automobile|equity|2382
AEGISLOG|Aegis Logistics|Energy|equity|2343
UTIAMC|Utiamc|Other|equity|2334
UBL|United Breweries|FMCG|equity|2315
DEVYANI|Devyani International|FMCG|equity|2308
PAISALO|Paisalo|Other|equity|2305
EMCURE|Emcure|Other|equity|2304
VIPIND|V.i.p.industries|Textiles|equity|2283
RAINBOW|Rainbow Children's Medicare|Healthcare|equity|2274
CRISIL|Crisil|Financial Services|equity|2273
GOLDBETA|Goldbeta|Other|equity|2269
GREAVESCOT|Greaves Cotton|Capital Goods|equity|2267
EPACKPEB|Epackpeb|Other|equity|2254
VOLTAMP|Voltamp Transformers|Capital Goods|equity|2248
GOLDIETF|Goldietf|Other|equity|2241
JKLAKSHMI|JK Lakshmi Cement|Cement|equity|2228
BORORENEW|Bororenew|Other|equity|2225
CENTRALBK|Central Bank of India|Banking|equity|2222
ARKADE|Arkade|Other|equity|2220
BERGEPAINT|Berger Paints India|Paints|equity|2204
SETFGOLD|Setfgold|Other|equity|2198
STARHEALTH|Star Health & Allied Insurance|Insurance|equity|2196
GPIL|Godawari Power & Ispat|Metals|equity|2192
DBREALTY|D B Realty|Real Estate|equity|2185
SUMICHEM|Sumitomo Chemical India|Chemicals|equity|2183
TECHNOE|Technoe|Other|equity|2171
WEBELSOLAR|Websol Energy System|Other|equity|2171
MSUMI|Msumi|Other|equity|2171
GARUDA|Garuda|Other|equity|2160
ABBOTINDIA|Abbott India|Pharma|equity|2138
ABDL|Abdl|Other|equity|2134
COHANCE|Cohance|Other|equity|2129
RRKABEL|Rrkabel|Other|equity|2127
ATUL|Atul|Chemicals|equity|2115
UCOBANK|UCO Bank|Banking|equity|2110
GPPL|Gujarat Pipavav Port|Services|equity|2110
JUNIORBEES|Nippon India ETF Nifty Next 50 Junior BeES|ETF|etf|2102
PRAJIND|Praj Industries|Infrastructure|equity|2078
WAAREERTL|Waareertl|Other|equity|2076
IPCALAB|Ipca Laboratories|Pharma|equity|2071
TATAINVEST|Tata Investment Corporation|Other|equity|2068
SCHAEFFLER|Schaeffler India|Auto Ancillary|equity|2052
KRBL|KRBL|FMCG|equity|2045
RTNINDIA|Rtnindia|Other|equity|2044
TEXRAIL|Texmaco Rail & Engineering|Infrastructure|equity|2043
INDGN|Indgn|Other|equity|2039
HDFCGOLD|Hdfcgold|Other|equity|2038
ABREL|Abrel|Other|equity|2035
RAYMONDREL|Raymondrel|Other|equity|2031
KTKBANK|Karnataka Bank|Banking|equity|2030
JWL|JWL|Other|equity|2028
DCBBANK|DCB Bank|Banking|equity|2016
AZAD|Azad|Other|equity|1991
BOMDYEING|Bombay Dyeing & Mfg.co.ltd|Textiles|equity|1988
KPIL|Kpil|Other|equity|1987
RCF|Rashtriya Chemicals & Fertilizers|Chemicals|equity|1987
THOMASCOOK|Thomas Cook (india)|Hospitality|equity|1978
AKZOINDIA|Akzo Nobel India|Paints|equity|1977
MOIL|MOIL|Mining|equity|1971
EMAMILTD|Emami|FMCG|equity|1969
FACT|Fertilisers & Chemicals Travancore|Chemicals|equity|1968
GICRE|General Insurance Corporation of India|Insurance|equity|1965
MODEFENCE|Modefence|Other|equity|1962
PTCIL|PTC Industries|Other|equity|1954
IOB|Indian Overseas Bank|Banking|equity|1953
LUMAXTECH|Lumax Auto Technologies|Auto Ancillary|equity|1947
CONCORDBIO|Concordbio|Other|equity|1940
CEMPRO|Cempro|Other|equity|1929
JSWCEMENT|Jswcement|Other|equity|1928
MANORAMA|Manorama|Other|equity|1928
JBMA|JBM Auto|Auto Ancillary|equity|1923
MIDHANI|Midhani|Other|equity|1921
GOKEX|Gokaldas Exports|Textiles|equity|1920
ELECTCAST|Electrosteel Castings|Infrastructure|equity|1894
BAYERCROP|Bayer Cropscience|FMCG|equity|1894
AARTIPHARM|Aarti Pharmalabs|Pharma|equity|1893
PARAGMILK|Paragmilk|Other|equity|1881
SMARTWORKS|Smartworks|Other|equity|1875
BAJAJCON|Bajajcon|Other|equity|1870
TRIDENT|Trident|Textiles|equity|1848
ELECON|Elecon Engineering|Capital Goods|equity|1838
ASTRAZEN|Astrazeneca Pharma India|Pharma|equity|1836
DEEPAKNTR|Deepak Nitrite|Chemicals|equity|1835
63MOONS|63moons|Other|equity|1833
GSFC|Gujarat State Fertilizers & Chemicals|Chemicals|equity|1832
INFIBEAM|Infibeam|Other|equity|1831
EPACK|Epack|Other|equity|1824
MCLOUD|Mcloud|Other|equity|1822
INDIAGLYCO|India Glycols|Chemicals|equity|1821
CCL|CCL Products (india)|FMCG|equity|1789
SPMLINFRA|SPML Infra|Infrastructure|equity|1783
AEQUS|Aequs|Other|equity|1781
ORIENTCEM|Orient Cement|Cement|equity|1773
VIKRAN|Vikran|Other|equity|1772
BCG|BCG|Other|equity|1757
NIVABUPA|Nivabupa|Other|equity|1754
RAYMONDLSL|Raymondlsl|Other|equity|1736
GODREJAGRO|Godrejagro|Other|equity|1725
VIJAYA|Vijaya|Other|equity|1724
SENORES|Senores|Other|equity|1718
SDBL|SOM Distilleries & Breweries|FMCG|equity|1710
CANHLIFE|Canhlife|Other|equity|1705
ERIS|Eris Lifesciences|Pharma|equity|1703
NUVOCO|Nuvoco|Other|equity|1701
FINCABLES|Finolex Cables|Other|equity|1689
DCXINDIA|Dcxindia|Other|equity|1681
POWERMECH|Powermech|Other|equity|1669
SARDAEN|Sarda Energy & Minerals|Metals|equity|1665
EQUITASBNK|Equitas Small Finance Bank|Banking|equity|1662
GALLANTT|Gallantt Metal|Metals|equity|1650
HDFCSML250|Hdfcsml250|Other|equity|1640
BAJAJHIND|Bajaj Hindusthan Sugar|FMCG|equity|1628
ASAHIINDIA|Asahi India Glass|Auto Ancillary|equity|1613
CMSINFO|Cmsinfo|Other|equity|1611
AVALON|Avalon|Other|equity|1606
SKFINDIA|SKF India|Capital Goods|equity|1606
PSUBNKBEES|Goldman Sachs PSU Bank Exchange Traded Scheme|Financial Services|equity|1601
RAIN|Rain Industries|Energy|equity|1594
SENCO|Senco|Other|equity|1594
HDFCSILVER|Hdfcsilver|Other|equity|1593
ENDURANCE|Endurance Technologies|Auto Ancillary|equity|1589
HPL|HPL|Other|equity|1586
CASHIETF|Cashietf|Other|equity|1583
DIGITIDE|Digitide|Other|equity|1581
GMRP&UI|Gmrp & UI|Other|equity|1580
DCMSHRIRAM|DCM Shriram|Conglomerate|equity|1572
SBC|SBC|Other|equity|1565
GNFC|Gujarat Narmada Valley Fertilizers & Chemicals|Chemicals|equity|1565
MASTEK|Mastek|IT|equity|1563
VIMTALABS|Vimta Labs|Pharma|equity|1557
SUDARSCHEM|Sudarshan Chemical Industries|Chemicals|equity|1541
ARVINDFASN|Arvindfasn|Other|equity|1533
AURIONPRO|Aurionpro Solutions|IT|equity|1533
ALOKINDS|Alokinds|Other|equity|1533
KIRLPNU|Kirloskar Pneumatic Co.ltd|Capital Goods|equity|1527
BLUESTONE|Bluestone|Other|equity|1527
AGIIL|AGI Infra|Other|equity|1515
DHANI|Dhani|Other|equity|1502
SIRCA|Sirca|Other|equity|1497
3MINDIA|3m India|Conglomerate|equity|1496
RHIM|Rhim|Other|equity|1492
CSBBANK|CSB Bank|Banking|equity|1483
JKTYRE|JK Tyre & Industries|Auto Ancillary|equity|1476
PREMEXPLN|Premexpln|Other|equity|1474
KNRCON|KNR Constructions|Infrastructure|equity|1470
AVANTEL|Avantel|Telecom|equity|1466
MANINDS|MAN Industries (india)|Infrastructure|equity|1462
ELGIEQUIP|Elgi Equipments|Capital Goods|equity|1460
INDIACEM|India Cements|Cement|equity|1447
LIQUID|Liquid|Other|equity|1444
ACE|Action Construction Equipment|Logistics|equity|1441
CANFINHOME|CAN FIN Homes|Financial Services|equity|1440
USHAMART|Usha Martin|Metals|equity|1440
THELEELA|Theleela|Other|equity|1431
JGCHEM|Jgchem|Other|equity|1424
GKSL|Gksl|Other|equity|1424
JYOTISTRUC|Jyoti Structures|Capital Goods|equity|1423
IDEAFORGE|Ideaforge|Other|equity|1417
MOREPENLAB|Morepen Laboratories|Pharma|equity|1410
PGIL|Pearl Global Industries|Textiles|equity|1408
CAPLIPOINT|Caplin Point Laboratories|Pharma|equity|1406
CERA|Cera Sanitaryware|Building Materials|equity|1406
KPEL|Kpel|Other|equity|1388
METROPOLIS|Metropolis Healthcare|Healthcare|equity|1386
IIFLCAPS|Iiflcaps|Other|equity|1377
SKIPPER|Skipper|Infrastructure|equity|1375
HONAUT|Honeywell Automation India|Other|equity|1370
MIDWESTLTD|Midwestltd|Other|equity|1363
RITES|Rites|Other|equity|1363
LIQUIDETF|DSP Nifty 1D Rate Liquid ETF|ETF|etf|1353
TBOTEK|Tbotek|Other|equity|1345
GLOBUSSPR|Globus Spirits|FMCG|equity|1343
RATEGAIN|Rategain|Other|equity|1342
KALAMANDIR|Kalamandir|Other|equity|1334
INDIQUBE|Indiqube|Other|equity|1333
MAPMYINDIA|Mapmyindia|Other|equity|1331
ANURAS|Anuras|Other|equity|1331
HERITGFOOD|Heritage Foods|FMCG|equity|1329
MANGCHEFER|Mangalore Chemicals & Fertilizers|Chemicals|equity|1321
BALRAMCHIN|Balrampur Chini Mills|FMCG|equity|1320
ZAGGLE|Zaggle|Other|equity|1320
SETFNIF50|SBI Nifty 50 ETF|ETF|etf|1312
PENIND|Pennar Industries|Metals|equity|1307
BALAMINES|Balaji Amines|Chemicals|equity|1306
MON100|Mon100|Other|equity|1300
MID150BEES|Mid150bees|Other|equity|1298
ASHOKA|Ashoka Buildcon|Infrastructure|equity|1297
ALGOQUANT|Algoquant|Other|equity|1293
BANCOINDIA|Banco Products (india)|Auto Ancillary|equity|1291
MINDACORP|Minda Corporation|Auto Ancillary|equity|1288
NFL|National Fertilizers|Chemicals|equity|1286
GODREJIND|Godrej Industries|Chemicals|equity|1280
SUNTV|Sun TV Network|Media|equity|1279
KIRIINDUS|Kiri Industries|Chemicals|equity|1277
GOODLUCK|Goodluck|Other|equity|1275
SUPRIYA|Supriya|Other|equity|1270
JTLIND|Jtlind|Other|equity|1264
HAPPSTMNDS|Happiest Minds Technologies|IT|equity|1258
SCHNEIDER|Schneider Electric Infrastructure|Capital Goods|equity|1257
INDIASHLTR|Indiashltr|Other|equity|1256
CHALET|Chalet Hotels|Hospitality|equity|1250
CRAMC|Cramc|Other|equity|1241
MARATHON|Marathon Nextgen Realty|Real Estate|equity|1237
ALKYLAMINE|Alkyl Amines Chemicals|Chemicals|equity|1236
GRWRHITECH|Grwrhitech|Other|equity|1233
FINPIPE|Finolex Industries|Building Materials|equity|1233
BIRLACORPN|Birla Corporation|Cement|equity|1231
HCC|Hindustan Construction Co.ltd|Infrastructure|equity|1220
LINDEINDIA|Linde India|Chemicals|equity|1219
QUADFUTURE|Quadfuture|Other|equity|1213
JISLJALEQS|Jain Irrigation Systems|Chemicals|equity|1212
MAHSEAMLES|Maharashtra Seamless|Infrastructure|equity|1211
KSCL|Kaveri Seed Company|Other|equity|1209
AIAENG|AIA Engineering|Other|equity|1202
ATLANTAELE|Atlantaele|Other|equity|1200
PNGJL|Pngjl|Other|equity|1200
HONASA|Honasa|Other|equity|1190
DYCL|Dycl|Other|equity|1190
MEDPLUS|Medplus|Other|equity|1188
TRIVENI|Triveni Engineering & Industries|FMCG|equity|1187
SJS|SJS|Other|equity|1184
SHRIPISTON|Shripiston|Other|equity|1178
CIGNITITEC|Cignititec|Other|equity|1177
CARERATING|Credit Analysis AND Research|Financial Services|equity|1176
DOMS|Doms|Other|equity|1173
IOLCP|IOL Chemicals & Pharmaceuticals|Chemicals|equity|1166
AXISCADES|AXISCADES Engineering Technologies|IT|equity|1166
UTLSOLAR|Utlsolar|Other|equity|1166
GODIGIT|Godigit|Other|equity|1163
MAHSCOOTER|Maharashtra Scooters|Automobile|equity|1161
PFIZER|Pfizer|Pharma|equity|1148
JUSTDIAL|Just Dial|Media|equity|1148
MTARTECH|Mtartech|Other|equity|1148
KALPATARU|Kalpataru|Other|equity|1146
MTNL|Mahanagar Telephone Nigam|Telecom|equity|1141
SGMART|Sgmart|Other|equity|1139
EXCELSOFT|Excelsoft|Other|equity|1135
CARBORUNIV|Carborundum Universal|Other|equity|1131
IPL|IPL|Other|equity|1129
JAIBALAJI|JAI Balaji Industries|Metals|equity|1124
THYROCARE|Thyrocare|Other|equity|1123
KITEX|Kitex Garments|Textiles|equity|1111
AARTIDRUGS|Aarti Drugs|Pharma|equity|1109
SHANKARA|Shankara|Other|equity|1108
GSPL|Gujarat State Petronet|Other|equity|1104
SCODATUBES|Scodatubes|Other|equity|1096
ACI|ACI|Other|equity|1092
NESCO|Nesco|Services|equity|1090
BIKAJI|Bikaji|Other|equity|1081
BECTORFOOD|Bectorfood|Other|equity|1076
SHAILY|Shaily Engineering Plastics|Chemicals|equity|1070
PRAKASH|Prakash Industries|Metals|equity|1069
E2E|E2E|Other|equity|1062
TIRUMALCHM|Thirumalai Chemicals|Chemicals|equity|1058
GUJGASLTD|Gujarat Gas|Energy|equity|1046
BBL|Bharat Bijlee|Other|equity|1045
AKUMS|Akums|Other|equity|1043
ZFCVINDIA|Zfcvindia|Other|equity|1042
CAPILLARY|Capillary|Other|equity|1036
DHANUKA|Dhanuka Agritech|FMCG|equity|1036
CLEAN|Clean Science & Technology|Chemicals|equity|1035
TATAGOLD|Tatagold|Other|equity|1027
GTLINFRA|GTL Infrastructure|Telecom|equity|1012
BATAINDIA|Bata India|Textiles|equity|1010
PARKHOTELS|Parkhotels|Other|equity|1004
SWARAJENG|Swaraj Engines|Auto Ancillary|equity|999
DAMCAPITAL|Damcapital|Other|equity|999
HARIOMPIPE|Hariompipe|Other|equity|997
SHRIRAMPPS|Shrirampps|Other|equity|994
VENTIVE|Ventive|Other|equity|992
TIPSMUSIC|Tipsmusic|Other|equity|991
REFEX|Refex Industries|Chemicals|equity|989
SETL|Setl|Other|equity|985
BLUEDART|Blue Dart Express|Logistics|equity|985
SUBROS|Subros|Auto Ancillary|equity|981
EASEMYTRIP|Easemytrip|Other|equity|972
HITECH|Hitech|Other|equity|972
EMIL|Emil|Other|equity|967
PACEDIGITK|Pacedigitk|Other|equity|962
MOSILVER|Mosilver|Other|equity|962
AWFIS|Awfis|Other|equity|960
TATVA|Tatva|Other|equity|960
ASKAUTOLTD|Askautoltd|Other|equity|956
HCG|HCG|Other|equity|955
EIHOTEL|EIH|Hospitality|equity|953
GOLDIAM|Goldiam International|Textiles|equity|953
PGHH|Procter & Gamble Hygiene & Health Care|FMCG|equity|952
RHETAN|Rhetan|Other|equity|951
VMART|V-Mart Retail|Retail|equity|949
TARC|Tarc|Other|equity|947
SAPPHIRE|Sapphire Foods India|FMCG|equity|946
SAREGAMA|Saregama India|Media|equity|943
JYOTHYLAB|Jyothy Laboratories|FMCG|equity|938
INFIBE-RE|Infibe RE|Other|equity|936
INOXGREEN|Inoxgreen|Other|equity|930
ITI|ITI|Telecom|equity|930
MANYAVAR|Manyavar|Other|equity|929
SANSERA|Sansera|Other|equity|927
EPL|EPL|Other|equity|925
SURYAROSNI|Surya Roshni|Metals|equity|924
NIFTYIETF|Niftyietf|Other|equity|923
MOL|MOL|Other|equity|922
EMSLIMITED|Emslimited|Other|equity|908
MONARCH|Monarch|Other|equity|905
OPTIEMUS|Optiemus Infracom|Other|equity|903
ALPEXSOLAR|Alpexsolar|Other|sme|903
FINEORG|Fine Organic Industries|Chemicals|equity|900
ARVIND|Arvind|Textiles|equity|895
NIACL|New India Assurance|Insurance|equity|890
VSTIND|VST Industries|FMCG|equity|889
PHARMABEES|Pharmabees|Other|equity|888
MOSCHIP|Moschip Semiconductor Technology|IT|equity|887
JKIL|J.kumar Infraprojects|Infrastructure|equity|878
SEPC|Sepc|Other|equity|876
PRUDENT|Prudent|Other|equity|868
RENUKA|Shree Renuka Sugars|FMCG|equity|867
TRUALT|Trualt|Other|equity|864
BRIGHOTEL|Brighotel|Other|equity|863
GENESYS|Genesys International Corporation|IT|equity|859
VENUSPIPES|Venuspipes|Other|equity|852
PSPPROJECT|Pspproject|Other|equity|850
LATENTVIEW|Latentview|Other|equity|845
RUBICON|Rubicon|Other|equity|843
PNCINFRA|PNC Infratech|Infrastructure|equity|841
V2RETAIL|V2 Retail|Other|equity|841
NEPHROPLUS|Nephroplus|Other|equity|839
SINDHUTRAD|Sindhu Trade Links|Services|equity|839
PATELENG|Patel Engineering|Infrastructure|equity|836
METROBRAND|Metrobrand|Other|equity|835
ZYDUSWELL|Zydus Wellness|FMCG|equity|835
STYLEBAAZA|Stylebaaza|Other|equity|833
KELLTONTEC|Kellton Tech Solutions|IT|equity|832
HGINFRA|Hginfra|Other|equity|832
VERANDA|Veranda|Other|equity|831
ARISINFRA|Arisinfra|Other|equity|830
RADHIKAJWE|Radhikajwe|Other|equity|828
CAMLINFINE|Camlinfine|Other|equity|827
ZOTA|Zota|Other|equity|826
WEWORK|Wework|Other|equity|826
GEPIL|Gepil|Other|equity|825
MANINFRA|MAN Infraconstruction|Infrastructure|equity|823
STALLION|Stallion|Other|equity|822
JKPAPER|JK Paper|Industrials|equity|820
ALIVUS|Alivus|Other|equity|818
PARKHOSPS|Parkhosps|Other|equity|815
ROUTE|Route|Other|equity|812
VIYASH|Viyash|Other|equity|810
FEDFINA|Fedfina|Other|equity|805
AGARWALEYE|Agarwaleye|Other|equity|805
RAJESHEXPO|Rajesh Exports|Textiles|equity|800
ENTERO|Entero|Other|equity|799
SANDUMA|Sandur Manganese & Iron Ores|Metals|equity|798
DCW|DCW|Energy|equity|794
EUREKAFORB|Eurekaforb|Other|equity|793
KIOCL|Kiocl|Other|equity|793
AETHER|Aether|Other|equity|790
INOXINDIA|Inoxindia|Other|equity|790
MEDIASSIST|Mediassist|Other|equity|789
ALLCARGO|Allcargo Logistics|Logistics|equity|788
CEIGALL|Ceigall|Other|equity|786
AGI|AGI|Other|equity|784
HIRECT|Hind Rectifiers|Consumer Durables|equity|779
SEQUENT|Sequent Scientific|Pharma|equity|778
LXCHEM|Lxchem|Other|equity|776
PRICOLLTD|Pricolltd|Other|equity|774
SAKSOFT|Saksoft|IT|equity|773
INDRAMEDCO|Indraprastha Medical Corp.ltd|Pharma|equity|772
FIEMIND|Fiem Industries|Auto Ancillary|equity|770
SHILCTECH|Shilchar Technologies|Other|equity|768
GKENERGY|Gkenergy|Other|equity|767
LTGILTBEES|Ltgiltbees|Other|equity|767
RELAXO|Relaxo Footwears|Textiles|equity|766
DLINKINDIA|D-Link (India)|Other|equity|760
MBAPL|Mbapl|Other|equity|759
KRISHANA|Krishana|Other|equity|758
TVSHLTD|Tvshltd|Other|equity|757
APLLTD|Alembic Pharmaceuticals|Pharma|equity|755
EVEREADY|Eveready Industries India|FMCG|equity|749
VSTTILLERS|VST Tillers Tractors|Automobile|equity|749
BASF|Basf India|Chemicals|equity|749
GOLDADD|Goldadd|Other|equity|747
FILATEX|Filatex India|Textiles|equity|746
HIMATSEIDE|Himatsingka Seide|Textiles|equity|739
CARYSIL|Carysil|Other|equity|739
VGUARD|V-guard Industries|Other|equity|731
THANGAMAYL|Thangamayil Jewellery|Textiles|equity|730
NELCO|Nelco|Other|equity|728
GOLD1|Gold1|Other|equity|727
CAPACITE|Capacite|Other|equity|727
GOKULAGRO|Gokulagro|Other|equity|724
GANECOS|Ganesha Ecosphere|Services|equity|722
HIKAL|Hikal|Pharma|equity|721
VRLLOG|VRL Logistics|Logistics|equity|720
JSFB|Jsfb|Other|equity|720
COSMOFIRST|Cosmofirst|Other|equity|719
ANUP|Anup|Other|equity|716
VTL|Vardhman Textiles|Textiles|equity|715
SUNTECK|Sunteck Realty|Real Estate|equity|710
GULFOILLUB|Gulf Oil Lubricants India|Energy|equity|707
JAMNAAUTO|Jamna Auto Industries|Auto Ancillary|equity|707
SERVOTECH|Servotech|Other|equity|705
CPSEETF|CPSE ETF|ETF|etf|704
VIDYAWIRES|Vidyawires|Other|equity|702
DELTACORP|Delta Corp|Services|equity|699
DEEPINDS|Deepinds|Other|equity|698
STARCEMENT|Star Cement|Cement|equity|697
SUNFLAG|Sunflag Iron & Steel Co.ltd|Metals|equity|695
BLUSPRING|Bluspring|Other|equity|695
BLISSGVS|Bliss GVS Pharma|FMCG|equity|694
DODLA|Dodla|Other|equity|694
JARO|Jaro|Other|equity|693
DECCANCE|Deccan Cements|Cement|equity|692
FINOPB|Finopb|Other|equity|692
SUDEEPPHRM|Sudeepphrm|Other|equity|689
WELENT|Welent|Other|equity|687
ADVENZYMES|Advenzymes|Other|equity|685
KSHINTL|Kshintl|Other|equity|683
DENTA|Denta|Other|equity|683
FUSION|Fusion|Other|equity|681
PICCADIL|Piccadily Agro Industries|FMCG|equity|680
SPIC|Southern Petrochemicals|Chemicals|equity|678
INTERARCH|Interarch|Other|equity|676
PRINCEPIPE|Princepipe|Other|equity|674
IONEXCHANG|ION Exchange (india)|Capital Goods|equity|673
SUNDARMHLD|Sundarmhld|Other|equity|671
NSLNISP|Nslnisp|Other|equity|671
ORIANA|Oriana|Other|sme|667
CORONA|Corona|Other|equity|666
HINDOILEXP|Hindustan OIL Exploration Co.ltd|Energy|equity|661
AJAXENGG|Ajaxengg|Other|equity|658
SOLARA|Solara|Other|equity|657
NIBE|Nibe|Other|equity|657
BBTC|Bombay Burmah Trading Corp.ltd|FMCG|equity|657
SANGHVIMOV|Sanghvi Movers|Logistics|equity|656
NACLIND|Naclind|Other|equity|655
GRINDWELL|Grindwell Norton|Capital Goods|equity|653
IBULLSLTD|Ibullsltd|Other|equity|652
SOLARWORLD|Solarworld|Other|equity|649
SFL|SFL|Other|equity|647
UDS|UDS|Other|equity|646
MAHLOG|Mahlog|Other|equity|645
JINDRILL|Jindal Drilling & Industries|Energy|equity|642
QUESS|Quess|Other|equity|641
CAMPUS|Campus|Other|equity|640
TAJGVK|Tajgvk Hotels & Resorts|Hospitality|equity|638
PNBGILTS|PNB Gilts|Financial Services|equity|637
JINDWORLD|Jindal Worldwide|Textiles|equity|637
MSTCLTD|Mstcltd|Other|equity|636
STYRENIX|Styrenix|Other|equity|634
RAMASTEEL|Ramasteel|Other|equity|633
SHK|SHK|Other|equity|632
RAJOOENG|Rajoo Engineers|Capital Goods|equity|631
VPRPL|Vprpl|Other|equity|631
GMMPFAUDLR|Gmmpfaudlr|Other|equity|624
JASH|Jash|Other|equity|620
BUILDPRO|Buildpro|Other|equity|616
BALUFORGE|Baluforge|Other|equity|615
MOTISONS|Motisons|Other|equity|614
NIITMTS|Niitmts|Other|equity|613
RIIL|Reliance Industrial Infrastructure|Infrastructure|equity|613
TVSSCS|Tvsscs|Other|equity|610
CYIENTDLM|Cyientdlm|Other|equity|607
SHARDAMOTR|Shardamotr|Other|equity|601
POLYPLEX|Polyplex Corporation|Chemicals|equity|601
POKARNA|Pokarna|Infrastructure|equity|597
JSLL|Jsll|Other|equity|596
NOCIL|Nocil|Chemicals|equity|596
VARROC|Varroc|Other|equity|590
SAATVIKGL|Saatvikgl|Other|equity|590
AVL|AVL|Other|equity|589
SSWL|Steel Strips Wheels|Auto Ancillary|equity|589
SUNDRMFAST|Sundram Fasteners|Auto Ancillary|equity|583
INOXWI-RE|Inoxwi RE|Other|equity|582
SILVER|Silver|Other|equity|582
GHCL|Ghcl|Chemicals|equity|579
EPIGRAL|Epigral|Other|equity|576
STYLAMIND|Stylam Industries|Other|equity|576
ETHOSLTD|Ethosltd|Other|equity|575
REPCOHOME|Repco Home Finance|Financial Services|equity|574
CELLO|Cello|Other|equity|572
IGCL|Igcl|Other|equity|572
SMALLCAP|Smallcap|Other|equity|571
SALZERELEC|Salzerelec|Other|equity|571
QUICKHEAL|Quickheal|Other|equity|569
RBA|RBA|Other|equity|568
LIQUIDPLUS|Liquidplus|Other|equity|568
GATEWAY|Gateway|Other|equity|568
FMCGIETF|Fmcgietf|Other|equity|567
DYNAMATECH|Dynamatic Technologies|Capital Goods|equity|566
EMUDHRA|Emudhra|Other|equity|565
KOLTEPATIL|Kolte-patil Developers|Real Estate|equity|565
SYMPHONY|Symphony|Consumer Durables|equity|564
PANACEABIO|Panacea Biotec|Pharma|equity|563
RAMKY|Ramky Infrastructure|Infrastructure|equity|560
SHILPAMED|Shilpa Medicare|Pharma|equity|559
LMW|LMW|Other|equity|559
ICIL|Indo Count Industries|Textiles|equity|557
LUMAXIND|Lumax Industries|Auto Ancillary|equity|554
KRSNAA|Krsnaa|Other|equity|552
GIPCL|Gujarat Industries Power Co.ltd|Power|equity|552
NAVKARCORP|Navkarcorp|Other|equity|552
PSB|Punjab & Sind Bank|Banking|equity|551
SANATHAN|Sanathan|Other|equity|548
SBILIQETF|Sbiliqetf|Other|equity|548
ADVANCE|Advance|Other|equity|545
MAXESTATES|Maxestates|Other|equity|544
EXICOM|Exicom|Other|equity|543
GPTHEALTH|Gpthealth|Other|equity|542
VINATIORGA|Vinati Organics|Chemicals|equity|542
BAJAJHCARE|Bajajhcare|Other|equity|542
KSB|KSB|Other|equity|540
ORIENTTECH|Orienttech|Other|equity|540
ALPHA|Alpha Hi-tech Fuel|Metals|equity|538
IMFA|Indian Metals & Ferro Alloys|Metals|equity|535
BANSALWIRE|Bansalwire|Other|equity|527
SYSTMTXC|Systematix Corporate Services|Financial Services|equity|523
SULA|Sula|Other|equity|520
FABTECH|Fabtech|Other|equity|518
SILVERETF|Silveretf|Other|equity|516
SALASAR|Salasar|Other|equity|513
HLEGLAS|Hleglas|Other|equity|511
DPABHUSHAN|Dpabhushan|Other|equity|510
DBL|DBL|Other|equity|507
GLOBECIVIL|Globecivil|Other|equity|506
KERNEX|Kernex Microsystems (india)|Logistics|equity|506
GANESHHOUC|Ganesh Housing Corporation|Real Estate|equity|506
VADILALIND|Vadilal Industries|FMCG|equity|503
FMGOETZE|Federal-mogul Goetze (india)|Auto Ancillary|equity|503
MAHLIFE|Mahindra Lifespace Developers|Real Estate|equity|502
FCL|Fineotex Chemical|Chemicals|equity|502
FAZE3Q|Faze Three|Textiles|equity|502
FLYSBS|Flysbs|Other|sme|500
NDRAUTO|Ndrauto|Other|equity|499
INDIGOPNTS|Indigopnts|Other|equity|494
INFOBEAN|Infobean|Other|equity|494
PGHL|Pghl|Other|equity|491
FLAIR|Flair|Other|equity|490
CIEINDIA|Cieindia|Other|equity|489
GREENPANEL|Greenpanel|Other|equity|489
SHREEPUSHK|Shreepushk|Other|equity|489
SBISILVER|Sbisilver|Other|equity|488
SPARC|SUN Pharma Advanced Research Company|Pharma|equity|485
SAFEENTP|Safeentp|Other|sme|485
TATSILV|Tatsilv|Other|equity|485
VAIBHAVGBL|Vaibhav Global|IT|equity|485
SILVERADD|Silveradd|Other|equity|483
SHAREINDIA|Shareindia|Other|equity|483
HATHWAY|Hathway Cable & Datacom|Media|equity|482
NRBBEARING|NRB Bearings|Capital Goods|equity|481
KSL|Kalyani Steels|Metals|equity|481
MUTHOOTMF|Muthootmf|Other|equity|476
LGHL|Lghl|Other|equity|473
VISHNU|Vishnu Chemicals|Chemicals|equity|473
ROSSARI|Rossari|Other|equity|471
DIFFNKG|Diffnkg|Other|equity|469
WESTLIFE|Westlife Development|Hospitality|equity|469
KMEW|Kmew|Other|equity|468
JCHAC|Jchac|Other|equity|468
MANALIPETC|Manali Petrochemical|Energy|equity|466
UGROCAP|Ugrocap|Other|equity|465
WAKEFIT|Wakefit|Other|equity|463
MMTC|Mmtc|Retail|equity|463
AWHCL|Awhcl|Other|equity|460
NSIL|Nalwa Sons Investments|Financial Services|equity|458
MICEL|Micel|Other|equity|457
VASCONEQ|Vascon Engineers|Real Estate|equity|456
MAFANG|Mafang|Other|equity|456
MASTERTR|Master Trust|Financial Services|equity|455
GREENPOWER|Orient Green Power Company|Power|equity|453
HNGSNGBEES|Hngsngbees|Other|equity|453
INSECTICID|Insecticides (india)|FMCG|equity|449
UTKARSHBNK|Utkarshbnk|Other|equity|445
ADVAIT|Advait|Other|equity|445
ECOSMOBLTY|Ecosmoblty|Other|equity|444
BHARATWIRE|Bharatwire|Other|equity|444
TSFINV|Tsfinv|Other|equity|443
PARACABLES|Paramount Communications|Other|equity|443
SPANDANA|Spandana|Other|equity|443
SILVER1|Silver1|Other|equity|440
DIAMONDYD|Diamondyd|Other|equity|440
MIDCAPETF|Midcapetf|Other|equity|438
SANOFI|Sanofi India|Pharma|equity|437
SAWALIYA|Sawaliya|Other|sme|435
MPSLTD|MPS|Media|equity|434
FISCHER|Fischer Chemic|Chemicals|equity|431
GAEL|Gujarat Ambuja Exports|Other|equity|429
KDDL|Kddl|Textiles|equity|428
RPGLIFE|RPG Life Sciences|Pharma|equity|425
JAICORPLTD|JAI Corp|Metals|equity|424
AJMERA|Ajmera Realty & Infra India|Real Estate|equity|422
BHARATRAS|Bharat Rasayan|FMCG|equity|422
EFCIL|Efcil|Other|equity|422
KANSAINER|Kansai Nerolac Paints|Paints|equity|419
GOCOLORS|Gocolors|Other|equity|418
AIMTRON|Aimtron|Other|sme|417
INDOSTAR|Indostar|Other|equity|416
ORCHPHARMA|Orchpharma|Other|equity|416
GOLDETF|Goldetf|Other|equity|416
STEELXIND|Steel Exchange India|Metals|equity|415
IVALUE|Ivalue|Other|equity|411
AUTOBEES|Autobees|Other|equity|407
TTML|Tata Teleservices (maharashtra)|Telecom|equity|405
NIITLTD|Niit|Services|equity|404
SIYSIL|Siyaram Silk Mills|Textiles|equity|404
TNPETRO|Tamilnadu Petroproducts|Chemicals|equity|404
LAXMIDENTL|Laxmidentl|Other|equity|403
RATNAMANI|Ratnamani Metals & Tubes|Metals|equity|400
KIRLOSIND|Kirloskar Industries|Capital Goods|equity|400
ZUARI|Zuari Agro Chemicals|Chemicals|equity|400
STOVEKRAFT|Stovekraft|Other|equity|397
INGERRAND|Ingersoll-rand (india)|Capital Goods|equity|396
ASALCBR|Associated Alcohols & Breweries|FMCG|equity|395
ORKLAINDIA|Orklaindia|Other|equity|395
WCIL|Wcil|Other|equity|395
PIXTRANS|PIX Transmissions|Auto Ancillary|equity|393
IFBIND|IFB Industries|FMCG|equity|393
SUVEN|Suven Life Sciences|Pharma|equity|391
ARMANFIN|Arman Financial Services|Financial Services|equity|388
RSYSTEMS|Rsystems|Other|equity|388
GOPAL|Gopal|Other|equity|388
RATNAVEER|Ratnaveer|Other|equity|387
GCSL|Gcsl|Other|equity|386
ANTELOPUS|Antelopus|Other|equity|386
GEOJITFSL|Geojitfsl|Other|equity|386
MOLDTKPAC|Mold-Tek Packaging|Industrials|equity|386
SUPRAJIT|Suprajit Engineering|Auto Ancillary|equity|385
AXISGOLD|Axisgold|Other|equity|383
CENTUM|Centum Electronics|Services|equity|382
NELCAST|Nelcast|Other|equity|382
ALEMBICLTD|Alembic|Pharma|equity|382
RAMCOIND|Ramco Industries|Infrastructure|equity|382
BFUTILITIE|BF Utilities|Power|equity|381
REDTAPE|Redtape|Other|equity|381
GUJTHEM|Gujarat Themis Biosyn|Pharma|equity|381
STERTOOLS|Sterling Tools|Auto Ancillary|equity|381
HEMIPROP|Hemiprop|Other|equity|379
DANISH|Danish|Other|sme|379
INNOVACAP|Innovacap|Other|equity|379
BESTAGRO|Bestagro|Other|equity|377
FDC|FDC|Pharma|equity|377
TIIL|Technocraft Industries (india)|Metals|equity|377
VESUVIUS|Vesuvius India|Other|equity|376
COFFEEDAY|Coffeeday|Other|equity|373
TBZ|Tribhovandas Bhimji Zaveri|Textiles|equity|371
JLHL|Jlhl|Other|equity|371
NEXT50IETF|Next50ietf|Other|equity|370
ROTO|Roto Pumps|Capital Goods|equity|367
DREAMFOLKS|Dreamfolks|Other|equity|366
SANDHAR|Sandhar|Other|equity|366
CANTABIL|Cantabil Retail India|Textiles|equity|365
GOLDCASE|Goldcase|Other|equity|365
MONOLITH|Monolith|Other|sme|364
SRM|SRM|Other|equity|364
STYL|Styl|Other|equity|363
BBOX|Bbox|Other|equity|363
AHLUCONT|Ahluwalia Contracts (india)|Real Estate|equity|362
PARSVNATH|Parsvnath Developers|Real Estate|equity|360
ISGEC|Isgec Heavy Engineering|Capital Goods|equity|360
WINDMACHIN|Windsor Machines|Capital Goods|equity|358
WEL|WEL|Other|equity|356
UNIECOM|Uniecom|Other|equity|355
DDEVPLSTIK|Ddevplstik|Other|equity|355
GVPIL|Gvpil|Other|equity|354
NIFTYETF|Niftyetf|Other|equity|354
HUHTAMAKI|Huhtamaki|Other|equity|352
PDSL|Pdsl|Other|equity|350
JTEKTINDIA|Jtektindia|Other|equity|350
SBCL|Synergy Bizcon|Conglomerate|equity|349
GALAXYSURF|Galaxysurf|Other|equity|348
ICICIB22|Icicib22|Other|equity|347
JAGSNPHARM|Jagsonpal Pharmaceuticals|Pharma|equity|347
SAFARI|Safari|Other|equity|346
TEAMLEASE|Teamlease|Other|equity|345
MVGJL|Mvgjl|Other|equity|343
TMB|TMB|Other|equity|342
BANKNIFTY1|Banknifty1|Other|equity|341
YATRA|Yatra|Other|equity|341
GARFIBRES|Garfibres|Other|equity|340
KKCL|Kewal Kiran Clothing|Textiles|equity|339
MASFIN|Masfin|Other|equity|339
ARVSMART|Arvsmart|Other|equity|337
LOWVOLIETF|Lowvolietf|Other|equity|337
AXISILVER|Axisilver|Other|equity|337
MAITHANALL|Maithan Alloys|Metals|equity|333
PITTIENG|Pittieng|Other|equity|332
SELAN|Selan Exploration Technology|Energy|equity|332
UNIVCABLES|Universal Cables|Other|equity|332
ASTEC|Astec Lifesciences|FMCG|equity|330
ORISSAMINE|Orissa Minerals Development Company|Metals|equity|328
WSTCSTPAPR|West Coast Paper Mills|Industrials|equity|325
KCP|K.c.p.ltd|Cement|equity|325
PRECAM|Precam|Other|equity|322
GANESHCP|Ganeshcp|Other|equity|322
HEIDELBERG|Heidelbergcement India|Cement|equity|322
ARIHANTCAP|Arihantcap|Other|equity|321
OMAXE|Omaxe|Real Estate|equity|320
INDOTECH|Indo Tech Transformers|Capital Goods|equity|319
EKC|Everest Kanto Cylinder|Other|equity|317
RPSGVENT|Rpsgvent|Other|equity|315
GEMAROMA|Gemaroma|Other|equity|313
JPASSOCIAT|Jaiprakash Associates|Infrastructure|equity|313
BALMLAWRIE|Balmer Lawrie & Co.ltd|Conglomerate|equity|313
PURVA|Puravankara Projects|Real Estate|equity|311
BEPL|Bhansali Engineering Polymers|Chemicals|equity|310
20MICRONS|20 Microns|Metals|equity|310
MOREALTY|Morealty|Other|equity|309
KINGFA|Kingfa|Other|equity|309
APOLLOPIPE|Apollopipe|Other|equity|309
PRSMJOHNSN|Prsmjohnsn|Other|equity|308
WINDLAS|Windlas|Other|equity|308
NEOGEN|Neogen|Other|equity|308
IMAGICAA|Imagicaa|Other|equity|308
SRD|SRD|Other|equity|307
CENTURYPLY|Century Plyboards (i)|Other|equity|306
IGARASHI|Igarashi Motors India|Auto Ancillary|equity|305
CEWATER|Cewater|Other|equity|304
ROSSTECH|Rosstech|Other|equity|302
DEEDEV|Deedev|Other|equity|301
GREENPLY|Greenply Industries|Other|equity|301
SGLTL|Sgltl|Other|equity|301
SANSTAR|Sanstar|Other|equity|300
KAMDHENU|Kamdhenu|Other|equity|296
HERANBA|Heranba|Other|equity|296
SKFINDUS|Skfindus|Other|equity|294
GROWWDEFNC|Growwdefnc|Other|equity|293
SURAJEST|Surajest|Other|equity|291
GOLDSHARE|Goldshare|Other|equity|291
MARINE|Marine|Other|equity|289
UNIMECH|Unimech|Other|equity|289
TASTYBITE|Tastybite|Other|equity|287
MAYURUNIQ|Mayur Uniquoters|Textiles|equity|286
VENKEYS|Venkeys|Other|equity|286
MANGLMCEM|Mangalam Cement|Cement|equity|284
MANAKCOAT|Manakcoat|Other|equity|282
MOM30IETF|Mom30ietf|Other|equity|281
JUNIPER|Juniper|Other|equity|281
RGL|RGL|Other|equity|280
CARRARO|Carraro|Other|equity|279
KROSS|Kross|Other|equity|278
GLOTTIS|Glottis|Other|equity|278
LUXIND|Luxind|Other|equity|278
BAJAJELEC|Bajaj Electricals|FMCG|equity|278
PFS|PTC India Financial Services|Financial Services|equity|278
BORANA|Borana|Other|equity|277
INDOBORAX|Indo Borax & Chemicals|Chemicals|equity|277
MHRIL|Mahindra Holidays & Resorts India|Hospitality|equity|275
SMARTEN|Smarten|Other|sme|274
EIMCOELECO|Eimco Elecon (india)|Capital Goods|equity|273
NCLIND|NCL Industries|Cement|equity|272
WONDERLA|Wonderla Holidays|Other|equity|271
TAC|TAC|Other|sme|271
SGFIN|Sgfin|Other|equity|269
BAJAJINDEF|Bajajindef|Other|equity|269
ASAL|Automotive Stampings & Assemblies|Auto Ancillary|equity|268
ICRA|Icra|Financial Services|equity|267
PRECWIRE|Precision Wires India|Other|equity|267
MEIL|Meil|Other|equity|263
SPLPETRO|Splpetro|Other|equity|263
MUFIN|Mufin|Other|equity|261
NITCO|Nitco|Paints|equity|260
JNKINDIA|Jnkindia|Other|equity|260
CLSEL|Clsel|Other|equity|260
LICMFGOLD|Licmfgold|Other|equity|260
SHALBY|Shalby|Other|equity|259
NPST|Npst|Other|equity|258
DALMIASUG|Dalmia Bharat Sugar and Industries|FMCG|equity|257
ZEEMEDIA|Zee Media Corporation|Media|equity|257
MOCAPITAL|Mocapital|Other|equity|256
SPORTKING|Sportking|Other|equity|256
GMBREW|G.m.breweries|FMCG|equity|255
BLKASHYAP|B.l.kashyap AND Sons|Real Estate|equity|255
BHAGCHEM|Bhagiradha Chemicals & Industries|FMCG|equity|254
HNDFDS|Hindustan Foods|FMCG|equity|254
NITINSPIN|Nitin Spinners|Textiles|equity|254
CONFIPET|Confidence Petroleum India|Energy|equity|253
UDAICEMENT|Udaipur Cement Works|Cement|equity|253
BARBEQUE|Barbeque|Other|equity|252
KOPRAN|Kopran|Pharma|equity|252
JSWHL|JSW Holdings|Financial Services|equity|251
STEELCAS|Steelcast|Other|equity|250
ORIENTHOT|Oriental Hotels|Hospitality|equity|249
SAGCEM|Sagar Cements|Cement|equity|248
GUJALKALI|Gujarat Alkalies & Chemicals|Chemicals|equity|247
METALIETF|Metalietf|Other|equity|247
DOLLAR|Dollar|Other|equity|246
RPEL|Rpel|Other|equity|246
SARVESHWAR|Sarveshwar|Other|equity|243
MUKANDLTD|Mukand|Metals|equity|243
BODALCHEM|Bodal Chemicals|Chemicals|equity|243
STLNETWORK|Stlnetwork|Other|equity|242
INDOFARM|Indofarm|Other|equity|242
SATIN|Satin|Other|equity|242
XPROINDIA|Xpro India|Chemicals|equity|239
PUNJABCHEM|Punjab Chemicals AND Crop Protection|FMCG|equity|238
TTKPRESTIG|TTK Prestige|Other|equity|237
HARSHA|Harsha|Other|equity|236
CONTROLPR|Control Print|Industrials|equity|236
AONELIQUID|Aoneliquid|Other|equity|236
KRONOX|Kronox|Other|equity|233
SILVERTUC|Silvertuc|Other|equity|233
TALBROAUTO|Talbros Automotive Components|Auto Ancillary|equity|232
MOM100|Mom100|Other|equity|231
BOSCH-HCIL|Bosch Hcil|Other|equity|231
TCI|Transport Corporation OF India|Logistics|equity|231
MAHKTECH|Mahktech|Other|equity|231
AEROENTER|Aeroenter|Other|equity|228
DCAL|Dcal|Other|equity|228
PAKKA|Pakka|Other|equity|228
MASPTOP50|Masptop50|Other|equity|228
ADSL|Allied Digital Services|IT|equity|227
DBCORP|D B Corp|Media|equity|226
SHREDIGCEM|Shree Digvijay Cement Co.ltd|Cement|equity|226
MOMENTUM50|Momentum50|Other|equity|225
UFBL|Ufbl|Other|equity|224
ASIANENE|Asianene|Other|equity|222
PLATIND|Platind|Other|equity|222
SHANTIGEAR|Shanthi Gears|Auto Ancillary|equity|221
ARIES|Aries Agro|Chemicals|equity|221
ATULAUTO|Atul Auto|Automobile|equity|219
DHANBANK|Dhanlaxmi Bank|Banking|equity|218
FILATFASH|Filatex Fashions|Textiles|equity|217
MCLEODRUSS|Mcleod Russel India|FMCG|equity|215
VEEDOL|Veedol|Other|equity|211
RUSTOMJEE|Rustomjee|Other|equity|210
DOLATALGO|Dolatalgo|Other|equity|209
RICOAUTO|Rico Auto Industries|Auto Ancillary|equity|209
KRISHNADEF|Krishnadef|Other|equity|209
EBBETF0430|Ebbetf0430|Other|equity|208
DSSL|Dynacons Systems & Solutions|IT|equity|208
MGEL|Mgel|Other|equity|208
DEN|Den Networks|Media|equity|208
ROLEXRINGS|Rolexrings|Other|equity|206
GOCLCORP|Goclcorp|Other|equity|206
RUPA|Rupa & Company|Textiles|equity|206
LGBBROSLTD|L.g.balakrishnan & Bros.ltd|Auto Ancillary|equity|205
SPAL|Spal|Other|equity|205
RPTECH|Rptech|Other|equity|205
SANOFICONR|Sanoficonr|Other|equity|204
BCLIND|Bclind|Other|equity|204
WHEELS|Wheels India|Auto Ancillary|equity|203
GGBL|Ggbl|Other|sme|202
SETFNIFBK|Setfnifbk|Other|equity|200
GROWWMETAL|Growwmetal|Other|equity|200
ARTEMISMED|Artemismed|Other|equity|199
GANDHAR|Gandhar|Other|equity|199
GPECO|Gpeco|Other|sme|199
PPL|PPL|Other|equity|198
INDOAMIN|Indo Amines|Chemicals|equity|198
ITIETF|Itietf|Other|equity|198
MARKOLINES|Markolines|Other|equity|197
LAOPALA|LA Opala RG|Other|equity|196
WALCHANNAG|Walchandnagar Industries|Infrastructure|equity|196
HATSUN|Hatsun Agro Product|FMCG|equity|196
DREDGECORP|Dredging Corporation OF India|Logistics|equity|196
APS|APS|Other|sme|193
CHEMPLASTS|Chemplasts|Other|equity|192
SCILAL|Scilal|Other|equity|192
REMSONSIND|Remsons Industries|Auto Ancillary|equity|192
INDNIPPON|India Nippon Electricals|Auto Ancillary|equity|192
SMCGLOBAL|Smcglobal|Other|equity|192
RITCO|Ritco|Other|equity|192
GRINFRA|Grinfra|Other|equity|191
RAMRAT|RAM Ratna Wires|Other|equity|190
JAYKAY|Jaykay Enterprises|Financial Services|equity|190
NUCLEUS|Nucleus Software Exports|IT|equity|189
BOROLTD|Boroltd|Other|equity|189
C2C|C2C|Other|sme|189
GICHSGFIN|GIC Housing Finance|Financial Services|equity|188
GOLDETFADD|Goldetfadd|Other|equity|188
SMSPHARMA|SMS Pharmaceuticals|Pharma|equity|188
ORIENTELEC|Orientelec|Other|equity|187
ADVENTHTL|Adventhtl|Other|equity|187
SARTELE|Sartele|Other|sme|187
SACHEEROME|Sacheerome|Other|sme|186
EXCELINDUS|Excel Industries|FMCG|equity|186
PATELRMART|Patelrmart|Other|equity|186
STUDDS|Studds|Other|equity|185
KHAICHEM|Khaitan Chemicals & Fertilizers|Chemicals|equity|185
VGINFOTECH|Vginfotech|Other|sme|184
RESPONIND|Responsive Industries|Chemicals|equity|184
EEPL|Eepl|Other|sme|184
GANESHIN|Ganeshin|Other|sme|184
GANESHHOU|Ganeshhou|Other|equity|184
MSPL|MSP Steel & Power|Metals|equity|183
ADFFOODS|ADF Foods|FMCG|equity|181
HONDAPOWER|Honda Siel Power Products|Capital Goods|equity|181
HDFCNIFTY|Hdfcnifty|Other|equity|180
SETFNN50|Setfnn50|Other|equity|180
GODAVARIB|Godavarib|Other|equity|180
FWSTC|Fwstc|Other|sme|180
ANONDITA|Anondita|Other|sme|179
GILT5YBEES|Gilt5ybees|Other|equity|179
DWARKESH|Dwarikesh Sugar Industries|FMCG|equity|178
SILVERCASE|Silvercase|Other|equity|177
SIMPLEXINF|Simplex Infrastructures|Infrastructure|equity|177
AUTOAXLES|Automotive Axles|Auto Ancillary|equity|176
HINDWAREAP|Hindwareap|Other|equity|176
BAJEL|Bajel|Other|equity|175
ZUARIIND|Zuariind|Other|equity|175
SIS|SIS|Other|equity|175
BANKIETF|Bankietf|Other|equity|174
SAHANA|Sahana|Other|sme|174
TINNARUBR|Tinna Rubber and Infrastructure|Chemicals|equity|174
PVTBANIETF|Pvtbanietf|Other|equity|174
MOSMALL250|Mosmall250|Other|equity|174
SURYODAY|Suryoday|Other|equity|173
SIGNPOST|Signpost|Other|equity|173
SPUNWEB|Spunweb|Other|sme|172
ORICONENT|Oriconent|Other|equity|172
REGAAL|Regaal|Other|equity|172
GPTINFRA|GPT Infraprojects|Infrastructure|equity|172
KECL|Kirloskar Electric Company|Other|equity|172
OILIETF|Oilietf|Other|equity|171
MIDCAPIETF|Midcapietf|Other|equity|171
LANDMARK|Landmark|Other|equity|169
RAJRATAN|Rajratan|Other|equity|169
SYNCOMF|Syncom Formulations (india)|Pharma|equity|168
SHIVALIK|Shivalik Rasayan|FMCG|equity|168
MOS|MOS|Other|sme|167
ELECTHERM|Electrotherm (india)|Metals|equity|166
PILANIINVS|Pilaniinvs|Other|equity|166
INFLUX|Influx|Other|sme|166
KAMATHOTEL|Kamat Hotels (india)|Hospitality|equity|166
BIRLANU|Birlanu|Other|equity|166
SSEGL|Ssegl|Other|sme|166
PRABHA|Prabha|Other|equity|165
GROWWLIQID|Growwliqid|Other|equity|165
BSLGOLDETF|Bslgoldetf|Other|equity|163
SANGAMIND|Sangam (india)|Textiles|equity|162
NAVNETEDUL|Navneet Education|Media|equity|162
TCPLPACK|Tcpl Packaging|Industrials|equity|162
EGOLD|Egold|Other|equity|160
DHAMPURSUG|Dhampur Sugar Mills|FMCG|equity|160
SANGHIIND|Sanghi Industries|Cement|equity|160
URJA|Urja|Other|equity|159
UNITECH|Unitech|Real Estate|equity|159
UNICHEMLAB|Unichem Laboratories|Pharma|equity|158
MUFTI|Mufti|Other|equity|158
MMFL|M.m.forgings|Other|equity|158
INDIANHUME|Indian Hume Pipe Co.ltd|Cement|equity|157
SOLEX|Solex|Other|equity|157
INDOCO|Indoco Remedies|Pharma|equity|157
ROHLTD|Royal Orchid Hotels|Hospitality|equity|156
AVPINFRA|Avpinfra|Other|sme|155
OSWALAGRO|Oswal Agro Mills|Other|equity|155
ANNAPURNA|Annapurna|Other|equity|155
GALAPREC|Galaprec|Other|equity|153
JUBLCPL|Jublcpl|Other|equity|153
PATILAUTOM|Patilautom|Other|sme|153
SNOWMAN|Snowman Logistics|Logistics|equity|152
AHCL|Ahcl|Other|equity|151
UNIPARTS|Uniparts|Other|equity|151
SILVERBND|Silverbnd|Other|equity|151
JINDALPOLY|Jindal Poly Films|Chemicals|equity|150
ESILVER|Esilver|Other|equity|148
GUFICBIO|Gufic Biosciences|Pharma|equity|148
BAHETI|Baheti|Other|sme|148
AVADHSUGAR|Avadhsugar|Other|equity|147
VERTOZ|Vertoz|Other|equity|147
DMCC|Dmcc|Other|equity|146
BIRLAMONEY|Aditya Birla Money|Financial Services|equity|146
SKMEGGPROD|Skmeggprod|Other|equity|146
ESAFSFB|Esafsfb|Other|equity|145
RADIANTCMS|Radiantcms|Other|equity|145
CAPITALSFB|Capitalsfb|Other|equity|143
LINCOLN|Lincoln|Other|equity|142
PHANTOMFX|Phantomfx|Other|sme|142
ENCOMPAS|Encompas|Other|sme|141
MIRCELECTR|Mirc Electronics|Consumer Durables|equity|141
MADRASFERT|Madras Fertilizers|Other|equity|141
EUROPRATIK|Europratik|Other|equity|139
ARIHANTSUP|Arihantsup|Other|equity|139
SASKEN|Sasken Communication Technologies|IT|equity|139
IZMO|Izmo|IT|equity|139
NIFTY1|Nifty1|Other|equity|138
TOP10ADD|Top10add|Other|equity|138
INFRAIETF|Infraietf|Other|equity|137
RML|Rane (madras)|Auto Ancillary|equity|137
SAURASHCEM|Saurashtra Cement|Cement|equity|136
ALPL30IETF|Alpl30ietf|Other|equity|136
AONEGOLD|Aonegold|Other|equity|135
VINDHYATEL|Vindhya Telelinks|Telecom|equity|134
ASIANTILES|Asian Granito India|Paints|equity|134
THEJO|Thejo|Other|equity|134
AURUM|Aurum|Other|equity|134
GATECH|Gatech|Other|equity|134
CONSUMBEES|Consumbees|Other|equity|134
PRIMESECU|Prime Securities|Financial Services|equity|133
THEMISMED|Themis Medicare|Pharma|equity|133
DYNPRO|Dynemic Products|Chemicals|equity|133
HAPPYFORGE|Happyforge|Other|equity|132
MONTECARLO|Monte Carlo Fashions|Textiles|equity|132
TVSSRICHAK|TVS Srichakra|Auto Ancillary|equity|132
SEAMECLTD|Seamec|Logistics|equity|132
HDFCLIQUID|Hdfcliquid|Other|equity|131
ONMOBILE|OnMobile Global|Telecom|equity|131
ESABINDIA|Esab India|Other|equity|130
CUDML|Cudml|Other|sme|130
GSLSU|Gslsu|Other|equity|130
EXPLEOSOL|Expleosol|Other|equity|130
MAZDA|Mazda|Other|equity|129
ESTER|Ester Industries|Chemicals|equity|129
AXITA|Axita|Other|equity|128
GROWWGOLD|Growwgold|Other|equity|128
ESFL|Esfl|Other|sme|128
RANEHOLDIN|Rane Holdings|Auto Ancillary|equity|128
GANESHBE|Ganesh Benzoplast|Chemicals|equity|127
ACCENTMIC|Accentmic|Other|sme|127
TNPL|Tamil Nadu Newsprint & Papers|Industrials|equity|127
SHOPERSTOP|Shoppers Stop|Other|equity|126
INDOTHAI|Indo Thai Securities|Financial Services|equity|126
CELLECOR|Cellecor|Other|sme|126
HILINFRA|Hilinfra|Other|equity|125
COMSYN|Comsyn|Other|equity|125
CENTRUM|Centrum Capital|Financial Services|equity|125
OSELDEVICE|Oseldevice|Other|sme|125
SILVRETF|Silvretf|Other|equity|124
AGARIND|Agarwal Industrial Corporation|Energy|equity|124
PRAMARA|Pramara|Other|sme|124
MID150CASE|Mid150case|Other|equity|123
GULPOLY|Gulshan Polyols|Chemicals|equity|123
UFLEX|Uflex|Industrials|equity|123
AUTOIETF|Autoietf|Other|equity|122
LIKHITHA|Likhitha|Other|equity|122
DCMSRIND|Dcmsrind|Other|equity|122
YASHO|Yasho|Other|equity|121
NECLIFE|Nectar Lifesciences|Pharma|equity|121
SOMANYCERA|Somany Ceramics|Paints|equity|120
E2ERAIL|E2erail|Other|sme|120
ICEMAKE|Icemake|Other|equity|119
PAUSHAKLTD|Paushak|FMCG|equity|119
ENERGY|Energy|Other|equity|119
BOROSCI|Borosci|Other|equity|119
FINIETF|Finietf|Other|equity|118
VSSL|Vardhman Special Steels|Metals|equity|118
MIDSMALL|Midsmall|Other|equity|118
PROZONER|Prozoner|Other|equity|118
ONEPOINT|Onepoint|Other|equity|117
KCK|KCK|Other|sme|116
PENINLAND|Peninsula Land|Real Estate|equity|116
TOLINS|Tolins|Other|equity|116
PSUBANK|Psubank|Other|equity|116
GROWWSLVR|Growwslvr|Other|equity|115
ANDHRSUGAR|Andhra Sugars|Chemicals|equity|114
SJLOGISTIC|Sjlogistic|Other|sme|114
VINYAS|Vinyas|Other|sme|114
VMARCIND|Vmarcind|Other|sme|113
ALPHAETF|Alphaetf|Other|equity|113
APEX|Apex|Other|equity|113
ACLGATI|Aclgati|Other|equity|112
DEVX|Devx|Other|equity|112
SML100CASE|Sml100case|Other|equity|112
SGIL|Sgil|Other|equity|112
INTLCONV|International Conveyors|Chemicals|equity|112
AMRUTANJAN|Amrutanjan Health Care|Pharma|equity|112
ORIENTPPR|Orient Paper & Industries|Cement|equity|112
INNOVANA|Innovana|Other|equity|112
OSWALGREEN|Oswalgreen|Other|equity|111
ASHIANA|Ashiana Housing|Real Estate|equity|111
SCHAND|Schand|Other|equity|110
OLIL|Olil|Other|sme|110
VILAS|Vilas|Other|sme|110
CSSL|Cssl|Other|sme|110
PDMJEPAPER|Pdmjepaper|Other|equity|110
STANLEY|Stanley|Other|equity|110
NOVAAGRI|Novaagri|Other|equity|110
TEXINFRA|Texmaco Infrastructure & Holdings|Capital Goods|equity|109
OMINFRAL|Ominfral|Other|equity|109
IRMENERGY|Irmenergy|Other|equity|109
TRACXN|Tracxn|Other|equity|109
LIQUIDSHRI|Liquidshri|Other|equity|109
ARROWGREEN|Arrowgreen|Other|equity|108
VAKRANGEE|Vakrangee|Retail|equity|108
ZTECH|Ztech|Other|sme|108
SUMMITSEC|Summit Securities|Other|equity|107
IGPL|I G Petrochemicals|Chemicals|equity|106
ELM250|Elm250|Other|equity|106
ITDC|India Tourism Development Corporation|Hospitality|equity|106
RELTD|Reltd|Other|equity|106
TEMBO|Tembo|Other|equity|104
MALLCOM|Mallcom|Other|equity|104
RBZJEWEL|Rbzjewel|Other|equity|104
UTTAMSUGAR|Uttam Sugar Mills|FMCG|equity|104
IKIO|Ikio|Other|equity|104
BFINVEST|BF Investment|Other|equity|104
JKIPL|Jkipl|Other|equity|104
XCHANGING|Xchanging Solutions|IT|equity|103
ADOR|Ador|Other|equity|103
5PAISA|5paisa|Other|equity|103
VIKASLIFE|Vikaslife|Other|equity|102
KSOLVES|Ksolves|Other|equity|102
RUSHIL|Rushil Decor|Other|equity|101
GNA|GNA|Other|equity|101
BALAXI|Balaxi|Other|equity|101
SUNCLAY|Sunclay|Other|equity|101
VENUSREM|Venus Remedies|Pharma|equity|100
HEALTHIETF|Healthietf|Other|equity|100
SHALPAINTS|Shalimar Paints|Paints|equity|100
VOLERCAR|Volercar|Other|sme|99
SRHHYPOLTD|Sree Rayalaseema Hi-strength Hypo|Chemicals|equity|98
HGS|Hinduja Global Solutions|IT|equity|98
NIFTYBETA|Niftybeta|Other|equity|98
ETHOS-RE|Ethos RE|Other|equity|97
OMAXAUTO|Omax Autos|Auto Ancillary|equity|97
SOTL|Savita OIL Technologies|Energy|equity|97
JAGRAN|Jagran Prakashan|Media|equity|97
JAYBEE|Jaybee|Other|sme|97
UNITEDPOLY|Unitedpoly|Other|equity|96
BLSE|Blse|Other|equity|95
CIFL|Cifl|Other|equity|95
WANBURY|Wanbury|Pharma|equity|95
MEGASOFT|Megasoft|IT|equity|94
DISHTV|Dish TV India|Media|equity|94
PSUBNKIETF|Psubnkietf|Other|equity|94
CREATIVE|Creative|Other|equity|93
MAXIND|Maxind|Other|equity|93
ACCELYA|Accelya Kale Solutions Limitd|IT|equity|93
TECHD|Techd|Other|sme|92
BLAL|Blal|Other|equity|92
NDL|Nandan Denim|Textiles|equity|92
FRESHARA|Freshara|Other|sme|92
TCIEXP|Tciexp|Other|equity|92
AFSL|Afsl|Other|equity|92
PANAMAPET|Panama Petrochem|Energy|equity|91
FOSECOIND|Foseco India|Chemicals|equity|91
NEXT50|Next50|Other|equity|91
AMBIKCO|Ambika Cotton Mills|Textiles|equity|90
KICL|Kalyani Investment Company|Other|equity|89
HINDMOTORS|Hindustan Motors|Automobile|equity|87
TARSONS|Tarsons|Other|equity|87
UTINIFTETF|Utiniftetf|Other|equity|87
PUSHPA|Pushpa|Other|sme|87
IFGLEXPOR|Ifglexpor|Other|equity|86
ANDHRAPAP|Andhrapap|Other|equity|86
INFRABEES|Infrabees|Other|equity|85
BGRENERGY|BGR Energy Systems|Capital Goods|equity|85
JITFINFRA|Jitfinfra|Other|equity|85
RISHABH|Rishabh|Other|equity|84
ZIMLAB|Zimlab|Other|equity|84
GUJAPOLLO|Gujarat Apollo Industries|Automobile|equity|84
GROWWRAIL|Growwrail|Other|equity|84
EBBETF0431|Ebbetf0431|Other|equity|84
GHCLTEXTIL|Ghcltextil|Other|equity|83
RACLGEAR|Raclgear|Other|equity|83
3IINFOLTD|3iinfoltd|Other|equity|83
SUPREMEPWR|Supremepwr|Other|sme|83
TARACHAND|Tarachand|Other|equity|82
INDSWFTLAB|Ind-swift Laboratories|Pharma|equity|82
HEUBACHIND|Heubachind|Other|equity|82
LOKESHMACH|Lokesh Machines|Capital Goods|equity|81
SURAJLTD|Suraj|Metals|equity|81
KOKUYOCMLN|Kokuyo Camlin|FMCG|equity|81
KCEIL|Kceil|Other|sme|81
ALLTIME|Alltime|Other|equity|80
TVTODAY|TV Today Network|Media|equity|80
CENTENKA|Century Enka|Textiles|equity|80
ATMASTCO|Atmastco|Other|sme|80
SENSEXIETF|Sensexietf|Other|equity|80
SUBEXLTD|Subexltd|Other|equity|80
MEDICAMEQ|Medicamen Biotech|Pharma|equity|79
KOTHARIPET|Kotharipet|Other|equity|79
IRIS|Iris|Other|equity|79
MIDCAP|Midcap|Other|equity|79
SATIA|Satia|Other|equity|79
MUNJALSHOW|Munjal Showa|Auto Ancillary|equity|79
TECHERA|Techera|Other|sme|79
MONQ50|Monq50|Other|equity|79
SARLAPOLY|Sarla Performance Fibers|Textiles|equity|79
ONWARDTEC|Onward Technologies|IT|equity|78
OBSCP|Obscp|Other|sme|78
KHADIM|Khadim|Other|equity|78
MUNJALAU|Munjal Auto Industries|Auto Ancillary|equity|78
BETA|Beta|Other|equity|78
SURAKSHA|Suraksha|Other|equity|78
BIL|Bhartiya International|Textiles|equity|78
BUTTERFLY|Butterfly Gandhimathi Appliances|FMCG|equity|77
OCCLLTD|Occlltd|Other|equity|77
TAURIAN|Taurian|Other|sme|77
VMSTMT|Vmstmt|Other|equity|77
SAHASRA|Sahasra|Other|sme|77
CONNPLEX|Connplex|Other|sme|77
MMP|MMP|Other|equity|77
KRYSTAL|Krystal|Other|equity|76
UGARSUGAR|Ugar Sugar Works|FMCG|equity|76
QGOLDHALF|Qgoldhalf|Other|equity|76
SUNDROP|Sundrop|Other|equity|76
MOVALUE|Movalue|Other|equity|76
ALLETEC|Alletec|Other|sme|75
MODISONLTD|Modisonltd|Other|equity|75
JAINIK|Jainik|Other|sme|75
CGRAPHICS|Cgraphics|Other|sme|75
ATALREAL|Atalreal|Other|equity|75
LEMERITE|Lemerite|Other|equity|74
DENTALKART|Dentalkart|Other|sme|74
MUTHOOTCAP|Muthootcap|Other|equity|74
VIVIANA|Viviana|Other|equity|74
MMEL|Mmel|Other|sme|73
KODYTECH|Kodytech|Other|sme|73
APCOTEXIND|Apcotex Industries|Other|equity|73
EIHAHOTELS|EIH Associated Hotels|Hospitality|equity|73
RPPINFRA|RPP Infra Projects|Infrastructure|equity|73
NAMOEWASTE|Namoewaste|Other|sme|73
YUKEN|Yuken India|Auto Ancillary|equity|73
PROFX|Profx|Other|sme|72
SADHNANIQ|Sadhana Nitrochem|Chemicals|equity|72
DHARMAJ|Dharmaj|Other|equity|72
AFFORDABLE|Affordable|Other|equity|72
ITETF|Itetf|Other|equity|71
MOLDTECH|Moldtech|Other|equity|71
CHANDAN|Chandan|Other|sme|71
JAYSREETEA|Jaysreetea|Other|equity|71
AMANTA|Amanta|Other|equity|70
COOLCAPS|Coolcaps|Other|sme|70
RAMCOSYS|Ramco Systems|IT|equity|70
HLVLTD|Hlvltd|Other|equity|70
MUKKA|Mukka|Other|equity|69
ANUHPHR|Anuh Pharma|Pharma|equity|69
TIRUPATIFL|Tirupatifl|Other|equity|69
NEXT50BETA|Next50beta|Other|equity|69
VIKASECO|Vikaseco|Other|equity|69
KABRAEXTRU|Kabra Extrusiontechnik|Capital Goods|equity|68
MEGATHERM|Megatherm|Other|sme|68
WHITEFORCE|Whiteforce|Other|sme|68
RMDRIP|Rmdrip|Other|equity|68
NIF100BEES|Nif100bees|Other|equity|67
THOMASCOTT|Thomas Scott (india)|Textiles|equity|67
OCCL|Occl|Other|equity|67
SPENCERS|Spencers|Other|equity|67
MONIFTY500|Monifty500|Other|equity|67
MANCREDIT|Mangal Credit AND Fincorp|Financial Services|equity|67
RHFL|Rhfl|Other|equity|67
CHEMICAL|Chemical|Other|equity|66
BHAGYANGR|Bhagyangr|Other|equity|66
HMAAGRO|Hmaagro|Other|equity|66
RNFI|Rnfi|Other|sme|66
VISAKAIND|Visaka Industries|Cement|equity|66
BSE500IETF|Bse500ietf|Other|equity|66
GROWWEV|Growwev|Other|equity|66
MAGADSUGAR|Magadsugar|Other|equity|65
EVINDIA|Evindia|Other|equity|65
ELIN|Elin|Other|equity|65
TIL|TIL|Logistics|equity|65
ALICON|Alicon Castalloy|Metals|equity|65
WEALTH|Wealth|Other|equity|65
VALIANTORG|Valiantorg|Other|equity|65
MIRZAINT|Mirza International|Textiles|equity|65
NILASPACES|Nilaspaces|Other|equity|65
AVANA|Avana|Other|sme|65
GREENLAM|Greenlam|Other|equity|64
BSLNIFTY|Bslnifty|Other|equity|64
AAKAAR|Aakaar|Other|sme|64
HDFCMOMENT|Hdfcmoment|Other|equity|64
ALLDIGI|Alldigi|Other|equity|64
GRPLTD|GRP|Auto Ancillary|equity|64
BMWVENTLTD|Bmwventltd|Other|equity|64
LIQGRWBEES|Liqgrwbees|Other|equity|63
BASILIC|Basilic|Other|sme|63
TRANSTEEL|Transteel|Other|sme|63
VIPCLOTHNG|Vipclothng|Other|equity|63
NILAINFRA|Nilainfra|Other|equity|62
DBOL|Dbol|Other|equity|62
SINCLAIR|Sinclairs Hotels|Hospitality|equity|62
DBEIL|Dbeil|Other|equity|62
CHEMCON|Chemcon|Other|equity|62
AFIL|Afil|Other|equity|62
GOACARBON|GOA Carbon|Energy|equity|62
HDFCMID150|Hdfcmid150|Other|equity|62
FROG|Frog|Other|sme|62
FAIRCHEMOR|Fairchemor|Other|equity|61
SHRIAHIMSA|Shriahimsa|Other|sme|61
VETO|Veto|Other|equity|61
NILKAMAL|Nilkamal|Chemicals|equity|61
GROWWCAPM|Growwcapm|Other|equity|61
MANBA|Manba|Other|equity|61
OWAIS|Owais|Other|sme|61
SWELECTES|Swelect Energy Systems|Capital Goods|equity|60
FCSSOFT|FCS Software Solutions|IT|equity|60
MVKAGRO|Mvkagro|Other|sme|60
NV20IETF|Nv20ietf|Other|equity|60
METAL|Metal|Other|equity|60
ABSMARINE|Absmarine|Other|sme|60
IT|IT|Other|equity|60
MASON|Mason|Other|sme|59
TECHLABS|Techlabs|Other|sme|59
SAHAJSOLAR|Sahajsolar|Other|sme|59
BALAJITELE|Balaji Telefilms|Media|equity|59
MBLINFRA|MBL Infrastructures|Infrastructure|equity|59
UFO|UFO Moviez India|Retail|equity|58
MEDICO|Medico|Other|equity|58
MOMOMENTUM|Momomentum|Other|equity|58
APTECHT|Aptech|Services|equity|58
NAHARSPING|Nahar Spinning Mills|Textiles|equity|57
ABINFRA|Abinfra|Other|equity|57
MWL|MWL|Other|equity|57
GROWWPOWER|Growwpower|Other|equity|57
DIVGIITTS|Divgiitts|Other|equity|57
TRF|TRF|Automobile|equity|57
RUCHIRA|Ruchira Papers|Industrials|equity|57
KDL|KDL|Other|sme|57
PVSL|Pvsl|Other|equity|57
SUNTECH|Suntech|Other|sme|56
CORDSCABLE|Cords Cable Industries|Other|equity|56
LORDSCHLO|Lords Chloro Alkali|Chemicals|equity|56
BALAJEE|Balajee|Other|equity|56
MACPOWER|Macpower|Other|equity|56
SPECTRUM|Spectrum|Other|equity|56
EXCEL|Excel Realty N Infra|IT|equity|56
AARON|Aaron|Other|equity|56
BHARATSE|Bharat Seats|Auto Ancillary|equity|56
BHAGERIA|Bhageria DYE Chem|Chemicals|equity|56
LIQUIDSBI|Liquidsbi|Other|equity|56
FOODSIN|Foods & Inns|Other|equity|55
IRISDOREME|Irisdoreme|Other|equity|55
ALANKIT|Alankit|Financial Services|equity|55
ATL|ATL|Other|equity|55
KUANTUM|Kuantum Papers|Industrials|equity|55
HARDWYN|Hardwyn|Other|equity|55
RBMINFRA|Rbminfra|Other|sme|55
MAHLOG-RE|Mahlog RE|Other|equity|55
SUDARCOLOR|Sudarcolor|Other|equity|54
DVL|DVL|Other|equity|53
VIDHIING|Vidhiing|Other|equity|53
EBBETF0433|Ebbetf0433|Other|equity|53
NIFTYCASE|Niftycase|Other|equity|53
SUYOG|Suyog Telematics|Telecom|equity|52
MENONBE|Menon Bearings|Auto Ancillary|equity|52
RUBFILA|Rubfila International|Auto Ancillary|equity|52
KKJEWELS|Kkjewels|Other|sme|52
KAYTEX|Kaytex|Other|sme|52
ARFIN|Arfin India|Metals|equity|52
RNBDENIMS|R&B Denims|Textiles|equity|52
KSR|KSR|Other|equity|51
MOKSH|Moksh|Other|equity|51
MATRIMONY|Matrimony|Other|equity|51
CHEMBONDCH|Chembondch|Other|equity|51
AVTNPL|AVT Natural Products|Other|equity|50
TPLPLASTEH|Tplplasteh|Other|equity|50
FELIX|Felix|Other|sme|50
AONETOTAL|Aonetotal|Other|equity|50
VGL|VGL|Other|equity|50
ELIQUID|Eliquid|Other|equity|50
MAHEPC|Mahepc|Other|equity|50
A2ZINFRA|A2Z Infra Engineering|Other|equity|50
SHREERAMA|Shree Rama Multi-tech|Industrials|equity|50
BFSI|Bfsi|Other|equity|49
BPL|BPL|Consumer Durables|equity|49
RCOM|Reliance Communications|Telecom|equity|49
COMMOIETF|Commoietf|Other|equity|49
RKSWAMY|Rkswamy|Other|equity|49
REPRO|Repro India|Media|equity|48
NIRMAN|Nirman|Other|sme|48
RSWM|Rswm|Textiles|equity|48
DENORA|DE Nora India|Other|equity|48
DIVOPPBEES|Divoppbees|Other|equity|48
PYRAMID|Pyramid|Other|equity|48
SHYAMDHANI|Shyamdhani|Other|sme|48
TOP100CASE|Top100case|Other|equity|48
DHARAN|Dharan|Other|equity|48
CHOICEGOLD|Choicegold|Other|equity|47
PRIZOR|Prizor|Other|sme|47
DONEAR|Donear Industries|Textiles|equity|47
KRISHIVAL|Krishival|Other|equity|47
TNIDETF|Tnidetf|Other|equity|47
VIESL|Viesl|Other|sme|46
OMFREIGHT|Omfreight|Other|equity|46
ENVIRO|Enviro|Other|sme|46
MAWANASUG|Mawana Sugars|FMCG|equity|46
SAKAR|Sakar|Other|equity|46
DAVANGERE|Davangere|Other|equity|46
PRIMECAB|Primecab|Other|sme|46
DHARARAIL|Dhararail|Other|sme|46
PIGL|Pigl|Other|equity|45
UTSSAV|Utssav|Other|sme|45
BIGBLOC|Bigbloc|Other|equity|45
KARNIKA|Karnika|Other|sme|45
RUBYMILLS|Ruby Mills|Textiles|equity|45
RBS|RBS|Other|sme|45
NDTV|NEW Delhi Television|Media|equity|45
ATCENERGY|Atcenergy|Other|sme|45
GILLANDERS|Gillanders Arbuthnot & Co.ltd|Conglomerate|equity|45
MUNISH|Munish|Other|sme|45
SAVY|Savy|Other|sme|45
INDORAMA|Indo Rama Synthetics (india)|Textiles|equity|45
DEVIT|Devit|Other|equity|45
SPECIALITY|Speciality Restaurants|Hospitality|equity|44
MOENERGY|Moenergy|Other|equity|44
SMALL250|Small250|Other|equity|44
CHEMFAB|Chemfab|Other|equity|44
OAL|OAL|Other|equity|44
IFBAGRO|IFB Agro Industries|FMCG|equity|44
CCCL|Consolidated Construction Consortium|Real Estate|equity|44
INTENTECH|Intense Technologies|IT|equity|44
GTPL|Gtpl|Other|equity|44
SPAND-RE|Spand RE|Other|equity|43
AVG|AVG|Other|equity|43
GEEKAYWIRE|Geekaywire|Other|equity|43
MODIS|Modis|Other|equity|43
EMKAY|Emkay Global Financial Services|Financial Services|equity|43
UNIVASTU|Univastu|Other|equity|42
HESTERBIO|Hester Biosciences|Pharma|equity|42
VALIANTLAB|Valiantlab|Other|equity|42
GCHOTELS|Gchotels|Other|sme|42
RAMAPHO|Rama Phosphates|Chemicals|equity|42
UTIBANKETF|Utibanketf|Other|equity|42
MARC|Marc|Other|sme|41
ALMONDZ|Almondz Global Securities|Financial Services|equity|41
MAXVOLT|Maxvolt|Other|sme|41
NIFTYADD|Niftyadd|Other|equity|41
TREL|Trel|Other|equity|41
HPAL|Hpal|Other|equity|41
JPOLYINVST|Jindal Poly Investment and Finance Company|Financial Services|equity|41
WINSOL|Winsol|Other|sme|41
TTKHLTCARE|Ttkhltcare|Other|equity|40
PONNIERODE|Ponni Sugars (erode)|FMCG|equity|40
SESHAPAPER|Seshasayee Paper & Boards|Industrials|equity|40
SHARIABEES|Goldman Sachs S&P CNX Nifty Shariah Index Exchange Traded Scheme|Financial Services|equity|40
AUTOIND|Autoline Industries|Auto Ancillary|equity|40
ZODIAC|Zodiac|Other|equity|40
CPEDU|Cpedu|Other|equity|40
WOMANCART|Womancart|Other|sme|40
URBAN|Urban|Other|sme|40
GLOBALVECT|Global Vectra Helicorp|Aviation|equity|39
FOCE|Foce|Other|sme|39
AYMSYNTEX|Aymsyntex|Other|equity|39
TSC|TSC|Other|sme|39
KAYA|Kaya|Other|equity|39
ORIENTALTL|Oriental Trimex|Infrastructure|equity|39
ALBERTDAVD|Albertdavd|Other|equity|39
VAISHALI|Vaishali|Other|equity|38
EPWINDIA|Epwindia|Other|sme|38
AGARWALTUF|Agarwaltuf|Other|sme|38
CYBERTECH|Cybertech Systems AND Software|IT|equity|38
SHETHJI|Shethji|Other|sme|38
CENTEXT|Century Extrusions|Metals|equity|38
HDFCNEXT50|Hdfcnext50|Other|equity|38
MANAKSIA|Manaksia|Industrials|equity|38
ENIL|Entertainment Network (india)|Media|equity|38
TWCGOLDETF|Twcgoldetf|Other|equity|38
NIKITA|Nikita|Other|sme|38
SUBAHOTELS|Subahotels|Other|sme|37
SOUTHWEST|Southwest|Other|equity|37
GROWWNET|Growwnet|Other|equity|37
GANDHITUBE|Gandhi Special Tubes|Metals|equity|37
SPCL|Spcl|Other|sme|37
JAYBARMARU|JAY Bharat Maruti|Auto Ancillary|equity|37
VISHNUINFR|Vishnuinfr|Other|sme|37
VARDMNPOLY|Vardhman Polytex|Textiles|equity|37
CLEDUCATE|Cleducate|Other|equity|37
AVROIND|Avroind|Other|equity|37
HTMEDIA|HT Media|Media|equity|36
AARTECH|Aartech|Other|equity|36
ESSENTIA|Essentia|Other|equity|36
TERASOFT|Tera Software|IT|equity|36
BAGDIGITAL|Bagdigital|Other|sme|36
VLSFINANCE|VLS Finance|Financial Services|equity|36
SETF10GILT|Setf10gilt|Other|equity|36
NRVANDANA|Nrvandana|Other|sme|36
BASML|Bannari Amman Spinning Mills|Textiles|equity|36
UTINEXT50|Utinext50|Other|equity|36
BBETF0432|Bbetf0432|Other|equity|36
PASUPTAC|Pasupati Acrylon|Chemicals|equity|35
TRANSWORLD|Transworld|Other|equity|35
ABAN|Aban Offshore|Energy|equity|35
SABTNL|Sabtnl|Other|equity|35
HDFCNIFBAN|Hdfcnifban|Other|equity|35
ELGNZ|Elgnz|Other|sme|35
PSUBANKADD|Psubankadd|Other|equity|35
FOCUS|Focus|Other|equity|35
STARTECK|Starteck|Other|equity|35
SHKSIL|Shksil|Other|sme|35
AARVEEDEN|Aarvee Denims & Exports|Textiles|equity|35
GODHA|Godha|Other|equity|34
HILTON|Hilton Metal Forging|Other|equity|34
AKIKO|Akiko|Other|sme|34
RTL|RTL|Other|sme|34
SASTASUNDR|Sastasundr|Other|equity|34
SOFTTECH|Softtech|Other|equity|34
TVSELECT|TVS Electronics|Media|equity|34
PREMIERPOL|Premier Polyfilm|Chemicals|equity|34
NIFTY50ADD|Nifty50add|Other|equity|34
IMPAL|India Motor Parts & Accessories|Retail|equity|34
IVZINGOLD|Ivzingold|Other|equity|34
BLUEWATER|Bluewater|Other|sme|34
MAYASHEEL|Mayasheel|Other|sme|34
BANSWRAS|Banswara Syntex|Textiles|equity|34
GSMFOILS|Gsmfoils|Other|sme|33
EFFWA|Effwa|Other|sme|33
CONSUMIETF|Consumietf|Other|equity|33
KCPSUGIND|KCP Sugar & Industries Corporation|FMCG|equity|33
UMIYA-MRO|Umiya MRO|Other|equity|33
DOLPHIN|Dolphin|Other|equity|32
NARMADA|Narmada|Other|equity|32
SURANASOL|Surana Solar|Other|equity|32
WORTH|Worth Investment & Trading Co|Other|equity|32
DENEERS|Deneers|Other|sme|32
GROWWMOM50|Growwmom50|Other|equity|32
VRAJ|Vraj|Other|equity|32
CEDAAR|Cedaar|Other|sme|32
PARIN|Parin|Other|sme|32
CROWN|Crown|Other|equity|32
KRISHCA|Krishca|Other|sme|32
GICL|Gicl|Other|equity|32
CSLFINANCE|Cslfinance|Other|equity|32
GTL|GTL|Telecom|equity|32
AIRAN|Airan|Other|equity|32
HIGREEN|Higreen|Other|sme|32
ABSLLIQUID|Abslliquid|Other|equity|32
OILCOUNTUB|OIL Country Tubular|Energy|equity|32
PVP|PVP Ventures|Real Estate|equity|32
IEL|IEL|Other|equity|31
DRONE|Drone|Other|sme|31
IEML|Ieml|Other|sme|31
INDOWIND|Indowind Energy|Power|equity|31
AAREYDRUGS|Aareydrugs|Other|equity|31
MIDSELIETF|Midselietf|Other|equity|31
PURPLEUTED|Purpleuted|Other|sme|31
TGL|TGL|Other|sme|31
CHEVIOT|Cheviot Co.ltd|Other|equity|31
CREST|Crest Ventures|Services|equity|31
PAVNAIND|Pavnaind|Other|equity|31
ASMS|Asms|Other|equity|31
EUROBOND|Eurobond|Other|equity|31
AURIGROW|Aurigrow|Other|equity|30
REMUS|Remus|Other|sme|30
AERON|Aeron|Other|sme|30
VLEGOV|Vlegov|Other|equity|30
LYKALABS|Lyka Labs|Pharma|equity|30
CNL|CNL|Other|equity|30
MINDTECK|Mindteck (india)|IT|equity|30
NATHBIOGEN|Nath Bio-Genes (India)|Other|equity|30
PANACHE|Panache|Other|equity|30
SYSTANGO|Systango|Other|sme|30
GOLDBND|Goldbnd|Other|equity|30
HARRMALAYA|Harrisons Malayalam|Auto Ancillary|equity|30
VIRINCHI|Virinchi|Other|equity|30
SUMIT|Sumit|Other|equity|29
MEGASTAR|Megastar|Other|equity|29
VINSYS|Vinsys|Other|sme|29
NEPHROCARE|Nephrocare|Other|sme|29
SWARAJ|Swaraj|Other|equity|29
DYNAMIC|Dynamic|Other|sme|29
GULFPETRO|GP Petroleums|Energy|equity|29
SBIETFIT|Sbietfit|Other|equity|29
NIF100IETF|Nif100ietf|Other|equity|29
SILKY|Silky|Other|sme|29
ORIENTCER|Orientcer|Other|equity|29
LIBERTSHOE|Liberty Shoes|Textiles|equity|29
EVERESTIND|Everest Industries|Cement|equity|29
ZEELEARN|ZEE Learn|Services|equity|29
MAANALU|Maan Aluminium|Infrastructure|equity|28
BELLACASA|Bellacasa|Other|equity|28
INDOUS|Indous|Other|equity|28
SAKUMA|Sakuma Exports|Retail|equity|28
JAYAGROGN|Jayant Agro-organics|Chemicals|equity|28
PCCL|Pccl|Other|sme|28
UNIDT|United Drilling Tools|Other|equity|28
PRIMO|Primo|Other|equity|28
ABCOTS|A B Cotspin India|Textiles|equity|27
UCAL|Ucal|Other|equity|27
NAHARPOLY|Nahar Polyfilms|Textiles|equity|27
RANASUG|Rana Sugars|FMCG|equity|27
SSDL|Ssdl|Other|equity|27
AERONEU|Aeroneu|Other|equity|27
GFLLIMITED|Gfllimited|Other|equity|27
NV20BEES|Nv20bees|Other|equity|27
NGLFINE|NGL Fine-chem|Pharma|equity|27
SUPREME|Supreme Holdings & Hospitality (india)|Financial Services|equity|27
LTGILTCASE|Ltgiltcase|Other|equity|27
AVONMORE|Avonmore Capital & Management Services|Financial Services|equity|27
HDFCSENSEX|Hdfcsensex|Other|equity|27
AONENIFTY|Aonenifty|Other|equity|27
TEJASCARGO|Tejascargo|Other|sme|27
VSTL|Vstl|Other|equity|26
HEALTHY|Healthy|Other|equity|26
SIKKO|Sikko|Other|equity|26
SHREEKARNI|Shreekarni|Other|sme|26
SCPL|Scpl|Other|equity|26
WSI|WSI|Other|equity|26
JAYESH|Jayesh|Other|sme|26
SADBHAV|Sadbhav Engineering|Infrastructure|equity|26
NAGAFERT|Nagafert|Other|equity|26
PTL|PTL Enterprises|Retail|equity|26
RAJMET|Rajmet|Other|equity|26
PLASTIBLEN|Plastiblends India|Chemicals|equity|26
TCL|TCL|Other|sme|25
OSIAHYPER|Osiahyper|Other|equity|25
QUESTLAB|Questlab|Other|sme|25
EMAPARTNER|Emapartner|Other|sme|25
SUKHJITS|Sukhjit Starch & Chemicals|Chemicals|equity|25
BCONCEPTS|Bconcepts|Other|equity|25
SUPREMEINF|Supreme Infrastructure India|Infrastructure|equity|25
GOLDTECH|Goldstone Technologies|IT|equity|25
BARFLEX|Barflex|Other|sme|25
AMJLAND|Amjland|Other|equity|25
RUDRA|Rudra|Other|equity|25
MAKEINDIA|Makeindia|Other|equity|25
DCM|DCM|Textiles|equity|25
VHL|Vardhman Holdings|Financial Services|equity|24
SUNLITE|Sunlite|Other|sme|24
THEINVEST|Theinvest|Other|equity|24
KMSUGAR|K.m.sugar Mills|FMCG|equity|24
KRITI|Kriti|Other|equity|24
BANKBETA|Bankbeta|Other|equity|24
TIMESGTY|Times Guaranty|Financial Services|equity|24
BRNL|Brnl|Other|equity|24
HERCULES|Hercules Hoists|Capital Goods|equity|24
SONAMLTD|Sonamltd|Other|equity|24
TBI|TBI|Other|sme|24
PPAP|PPAP Automotive|Auto Ancillary|equity|24
ABSLBANETF|Abslbanetf|Other|equity|24
PARTH|Parth|Other|sme|23
FINKURVE|Finkurve Financial Services|Financial Services|equity|23
GVKPIL|GVK Power & Infrastructure|Power|equity|23
ADVANIHOTR|Advani Hotels & Resorts (india)|Hospitality|equity|23
ESCONET|Esconet|Other|sme|23
KAMOPAINTS|Kamopaints|Other|equity|23
BANARISUG|Bannari Amman Sugars|FMCG|equity|23
JYOTIGLOBL|Jyotiglobl|Other|sme|23
SELLOWRAP|Sellowrap|Other|sme|23
BAIDFIN|Baidfin|Other|equity|23
CUBEXTUB|Cubex Tubings|Metals|equity|23
RNPL|Rnpl|Other|sme|23
DHARIWAL|Dhariwal|Other|sme|23
EXICOM-RE|Exicom RE|Other|equity|23
MANAKALUCO|Manakaluco|Other|equity|23
TIPSFILMS|Tipsfilms|Other|equity|23
LOWVOL1|Lowvol1|Other|equity|23
VASWANI|Vaswani Industries|Metals|equity|23
GLOBAL|Global Land Masters Corporation|Real Estate|equity|23
EVIETF|Evietf|Other|equity|22
NURECA|Nureca|Other|equity|22
SHAH|Shah|Other|equity|22
AESTHETIK|Aesthetik|Other|sme|22
KILITCH|Kilitch Drugs (india)|Pharma|equity|22
SAKHTISUG|Sakthi Sugars|FMCG|equity|22
INDIANCARD|Indian Card Clothing Co.ltd|Textiles|equity|22
GROWWSC250|Growwsc250|Other|equity|22
HDFCNIFIT|Hdfcnifit|Other|equity|22
SATKARTAR|Satkartar|Other|sme|22
COASTCORP|Coastal Corporation|Retail|equity|22
DIAMINESQ|Diamines & Chemicals|Chemicals|equity|22
RACE|Race|Other|equity|22
FIBERWEB|Fiberweb (india)|Chemicals|equity|22
ETML|Etml|Other|sme|22
GROWWNIFTY|Growwnifty|Other|equity|22
KOTYARK|Kotyark|Other|equity|22
MULTICAP|Multicap|Other|equity|22
AKSHARCHEM|Aksharchem|Other|equity|22
VISHWARAJ|Vishwaraj|Other|equity|22
MANGALAM|Mangalam Drugs & Organics|Pharma|equity|22
RKEC|Rkec|Other|equity|22
ALPHAGEO|Alphageo (india)|Energy|equity|22
MCL|Madhuban Constructions|Other|equity|22
VIPULLTD|Vipulltd|Other|equity|22
EMMBI|Emmbi Industries|Industrials|equity|21
MOHEALTH|Mohealth|Other|equity|21
MONEYBOXX|Moneyboxx|Other|equity|21
HINDCOMPOS|Hindustan Composites|Auto Ancillary|equity|21
PATINTLOG|Patel Integrated Logistics|Logistics|equity|21
EMAMIPAP|Emami Paper Mills|Industrials|equity|21
BTML|Btml|Other|equity|21
NIPPOBATRY|Indo-national|FMCG|equity|21
LINC|Linc|Other|equity|21
GENUSPAPER|Genus Paper & Boards|Industrials|equity|21
KNAGRI|Knagri|Other|equity|21
ASHIMASYN|Ashima|Textiles|equity|21
ORIENTBELL|Orient Bell|Paints|equity|21
TRIGYN|Trigyn Technologies|IT|equity|21
AARTISURF|Aartisurf|Other|equity|21
SAAKSHI|Saakshi|Other|sme|21
DPSCLTD|Dpscltd|Other|equity|21
IVC|Il&fs Investment Managers|Financial Services|equity|21
HITECHCORP|Hitechcorp|Other|equity|21
DCI|DCI|Other|equity|21
ESPRIT|Esprit|Other|sme|21
DPWIRES|Dpwires|Other|equity|20
TTL|T T|Textiles|equity|20
SHIVAMAUTO|Shivam Autotech|Auto Ancillary|equity|20
HMVL|Hindustan Media Ventures|Media|equity|20
CMNL|Cmnl|Other|sme|20
ETL|ETL|Other|sme|20
HOACFOODS|Hoacfoods|Other|sme|20
PRITIKAUTO|Pritikauto|Other|equity|20
MACOBSTECH|Macobstech|Other|sme|20
MNC|MNC|Other|equity|20
EIFFL|Eiffl|Other|equity|20
PRECOT|Precot|Other|equity|20
SIGMA|Sigma|Other|equity|20
EQUAL50ADD|Equal50add|Other|equity|20
KOHINOOR|Kohinoor Foods|Other|equity|20
GROWWRLTY|Growwrlty|Other|equity|20
GREENLEAF|Greenleaf|Other|sme|20
BIRLACABLE|Birlacable|Other|equity|20
TEXMOPIPES|Texmo Pipes & Products|Chemicals|equity|20
BHADORA|Bhadora|Other|sme|20
POSITRON|Positron|Other|sme|20
UHTL|Uhtl|Other|sme|19
KANDARP|Kandarp|Other|sme|19
HCL-INSYS|HCL Infosystems|IT|equity|19
INFOLLION|Infollion|Other|sme|19
ASAHISONG|Asahi Songwon Colors|Chemicals|equity|19
MAL|MAL|Other|sme|19
ORBTEXP|Orbit Exports|Textiles|equity|19
PLAZACABLE|Plazacable|Other|equity|19
GLOSTERLTD|Glosterltd|Other|equity|19
CINELINE|Cineline India|Retail|equity|19
DIGISPICE|Digispice|Other|equity|19
GENSOL|Gensol|Other|equity|19
VINYLINDIA|Vinyl Chemicals (india)|Chemicals|equity|19
BROOKS|Brooks Laboratories|Pharma|equity|19
SUNDRMBRAK|Sundaram Brake Linings|Auto Ancillary|equity|19
UNIHEALTH|Unihealth|Other|sme|19
SDREAMS|Sdreams|Other|sme|19
USK|USK|Other|equity|19
SPCENET|Spcenet|Other|equity|19
RHL|RHL|Other|equity|19
CHAVDA|Chavda|Other|sme|18
GSS|GSS Infotech|IT|equity|18
MOMENTUM|Momentum|Other|equity|18
PELATRO|Pelatro|Other|sme|18
HDFCGROWTH|Hdfcgrowth|Other|equity|18
SSFL|Ssfl|Other|sme|18
MPEL|Mpel|Other|sme|18
LANCORHOL|Lancor Holdings|Real Estate|equity|18
BEWLTD|Bewltd|Other|sme|18
SHERA|Shera|Other|sme|18
GINNIFILA|Ginni Filaments|Textiles|equity|18
UYFINCORP|Uyfincorp|Other|equity|18
OPTIVALUE|Optivalue|Other|sme|18
TREJHARA|Trejhara|Other|equity|18
WTICAB|Wticab|Other|sme|18
BYKE|Byke|Other|equity|18
APOLSINHOT|Apolsinhot|Other|equity|18
EMULTIMQ|Emultimq|Other|equity|18
AXISNIFTY|Axisnifty|Other|equity|18
PRAENG|Prajay Engineers Syndicate|Real Estate|equity|18
DUCON|Ducon|Other|equity|18
AGROPHOS|Agrophos|Other|equity|18
ISFT|Intrasoft Technologies|IT|equity|17
MOMIDMTM|Momidmtm|Other|equity|17
CAPTRUST|Captrust|Other|equity|17
HDFCPVTBAN|Hdfcpvtban|Other|equity|17
ALPA|Alpa Laboratories|Pharma|equity|17
STCINDIA|State Trading Corporation OF India|Retail|equity|17
QUAL30IETF|Qual30ietf|Other|equity|17
NINSYS|Ninsys|Other|equity|17
NEPTUNE|Neptune|Other|sme|17
TIGERLOGS|Tiger Logistics (India)|Logistics|equity|17
BALAJIPHOS|Balajiphos|Other|sme|17
IVP|IVP|Chemicals|equity|17
SUTLEJTEX|Sutlej Textiles & Industries|Textiles|equity|17
RAJINDLTD|Rajindltd|Other|sme|17
SAMAY|Samay|Other|sme|17
SHEETAL|Sheetal Diamonds|Textiles|sme|17
DICIND|DIC India|Chemicals|equity|17
BHARATGEAR|Bharat Gears|Auto Ancillary|equity|17
NRAIL|Nrail|Other|equity|17
EXIMROUTES|Eximroutes|Other|sme|17
NRL|NRL|Other|equity|16
BSHSL|Bshsl|Other|equity|16
ECOLINE|Ecoline|Other|sme|16
NV20|Nv20|Other|equity|16
AMNPLST|Amines & Plasticizers|Chemicals|equity|16
KESORAMIND|Kesoram Industries|Conglomerate|equity|16
SKP|Shri Krishna Prasadam|Retail|sme|16
FORCAS|Forcas|Other|sme|16
DJML|Djml|Other|equity|16
URAVIDEF|Uravidef|Other|equity|16
SHUBHSHREE|Shubhshree|Other|sme|16
FINBUD|Finbud|Other|sme|16
LAWSIKHO|Lawsikho|Other|sme|16
IWARE|Iware|Other|sme|16
NECCLTD|North Eastern Carrying Corporation|Logistics|equity|16
RPPL|Rppl|Other|equity|16
GEECEE|GeeCee Ventures|Chemicals|equity|16
RAPPID|Rappid|Other|sme|16
LAKSHYA|Lakshya|Other|sme|16
DCMNVL|Dcmnvl|Other|equity|16
KANPRPLA|Kanpur Plastipack|Industrials|equity|16
LATTEYS|Latteys|Other|equity|15
INVENTURE|Inventure Growth & Securities|Financial Services|equity|15
GLOBE|Globe|Other|equity|15
VHLTD|Vhltd|Other|equity|15
OMFURN|Omfurn|Other|sme|15
AJOONI|Ajooni|Other|equity|15
ASHWINI|Ashwini|Other|sme|15
MURUDCERA|Murudeshwar Ceramics|Paints|equity|15
ITETFADD|Itetfadd|Other|equity|15
K2INFRA|K2infra|Other|sme|15
KRITIKA|Kritika|Other|equity|15
APRAMEYA|Aprameya|Other|sme|15
SOMATEX|Soma Textiles & Industries|Textiles|equity|15
PRLIND|Prlind|Other|sme|15
TUNWAL|Tunwal|Other|sme|15
BHANDARI|Bhandari|Other|equity|15
VARDHACRLC|Vardhacrlc|Other|equity|15
ANYA|Anya|Other|sme|15
AVIANSH|Aviansh|Other|sme|15
SHREYANIND|Shreyans Industries|Industrials|equity|15
INVICTA|Invicta Meditek|Pharma|sme|15
SURANAT&P|Suranat & P|Other|equity|15
LOVABLE|Lovable Lingerie|Textiles|equity|15
CANARYS|Canarys|Other|sme|15
REPL|Repl|Other|equity|15
DHUNINV|Dhunseri Investments|Other|equity|15
PODDARMENT|Poddarment|Other|equity|14
BVCL|Barak Valley Cements|Cement|equity|14
BALPHARMA|BAL Pharma|Pharma|equity|14
NIFTYQLITY|Niftyqlity|Other|equity|14
ATAM|Atam|Other|equity|14
SMLT|Smlt|Other|equity|14
ROSSELLIND|Rossell India|FMCG|equity|14
KRITINUT|Kriti Nutrients|FMCG|equity|14
DCCL|Dccl|Other|sme|14
DUCOL|Ducol|Other|sme|14
HDFCPSUBK|Hdfcpsubk|Other|equity|14
GROWWN200|Growwn200|Other|equity|14
KAPSTON|Kapston|Other|equity|14
ISHANCH|Ishan Dyes & Chemicals|Chemicals|equity|14
MGSL|Mgsl|Other|sme|14
ARCHIDPLY|Archidply Industries|Other|equity|14
TARMAT|Tarmat|Infrastructure|equity|14
TICL|Ticl|Other|equity|14
AKSHOPTFBR|Aksh Optifibre|Telecom|equity|14
AAATECH|Aaatech|Other|equity|14
SOMICONVEY|Somiconvey|Other|equity|14
KAUSHALYA|Kaushalya Infrastructure Development Corporation|Infrastructure|equity|14
EXXARO|Exxaro|Other|equity|13
KOTARISUG|Kotarisug|Other|equity|13
UMANGDAIRY|Umangdairy|Other|equity|13
JAINAM|Jainam|Other|sme|13
TRU|TRU|Other|equity|13
CHEMBOND|Chembond Chemicals|Chemicals|equity|13
INDTERRAIN|Indian Terrain Fashions|Textiles|equity|13
YASHOPTICS|Yashoptics|Other|sme|13
FORGEAUTO|Forgeauto|Other|sme|13
POLYSIL|Polysil|Other|sme|13
SILGO|Silgo|Other|equity|13
ESSARSHPNG|Essar Shipping|Logistics|equity|13
GVPTECH|Gvptech|Other|equity|13
SHRIKANHA|Shrikanha|Other|sme|13
SHREEOSFM|Shreeosfm|Other|sme|13
UMAEXPORTS|Umaexports|Other|equity|13
STEELCITY|Steelcity|Other|equity|13
SHEMAROO|Shemaroo Entertainment|Media|equity|13
RAJSREESUG|Rajshree Sugars & Chemicals|FMCG|equity|13
DPEL|Dpel|Other|sme|13
READYMIX|Readymix|Other|sme|13
MAHASTEEL|Mahamaya Steel Industries|Metals|equity|13
SNEHAA|Snehaa|Other|sme|13
VISAMAN|Visaman|Other|sme|13
MANAKSTEEL|Manaksteel|Other|equity|13
UTISENSETF|Utisensetf|Other|equity|13
ADDICTIVE|Addictive|Other|sme|13
ECAPINSURE|Ecapinsure|Other|equity|13
FLEXIADD|Flexiadd|Other|equity|13
PILITA|Pilita|Other|equity|13
GOKUL|Gokul Refoils & Solvent|FMCG|equity|13
NBIFIN|Nbifin|Other|equity|13
CONSOFINVT|Consofinvt|Other|equity|13
ACL|ACL|Other|equity|13
WOL3D|Wol3d|Other|sme|13
STARPAPER|Star Paper Mills|Industrials|equity|13
PRITIKA|Pritika|Other|sme|12
TECH|Tech|Other|equity|12
AMCL|Amcl|Other|sme|12
SHRADHA|Shradha|Other|equity|12
ACCURACY|Accuracy|Other|equity|12
GANGABATH|Gangabath|Other|sme|12
NAHARINDUS|Nahar Industrial Enterprises|Textiles|equity|12
BOHRAIND|Bohraind|Other|equity|12
MITTAL|Mittal|Other|equity|12
STEL|STEL Holdings|Financial Services|equity|12
SUMEETINDS|Sumeet Industries|Textiles|equity|12
TAINWALCHM|Tainwala Chemicals & Plastics (india)|Chemicals|equity|12
SENSEXBETA|Sensexbeta|Other|equity|12
AAKASH|Aakash|Other|equity|12
ABSLPSE|Abslpse|Other|equity|12
MADHAVBAUG|Madhavbaug|Other|sme|12
HITECHGEAR|Hi-tech Gears|Auto Ancillary|equity|12
BEACON|Beacon|Other|sme|12
KAVDEFENCE|Kavdefence|Other|equity|12
ENFUSE|Enfuse|Other|sme|12
UEL|UEL|Other|equity|12
RSSOFTWARE|R.s.software India|IT|equity|12
TANKUP|Tankup|Other|sme|12
UNIENTER|Unienter|Other|equity|12
DELAPLEX|Delaplex|Other|sme|12
DELPHIFX|Delphifx|Other|equity|12
GROWWCHEM|Growwchem|Other|equity|12
INDSWFTLTD|Ind-swift|Pharma|equity|12
ANLON|Anlon|Other|sme|12
INNOMET|Innomet|Other|sme|12
EMAMIREAL|Emamireal|Other|equity|12
AHIMSA|Ahimsa|Other|sme|12
ATLANTAA|Atlantaa|Other|equity|12
HDFCQUAL|Hdfcqual|Other|equity|12
SLONE|Slone|Other|sme|12
SANDESH|Sandesh|Media|equity|12
PRAKASHSTL|Prakash Steelage|Infrastructure|equity|12
SATTVAENGG|Sattvaengg|Other|sme|12
AHLEAST|Asian Hotels (east)|Hospitality|equity|11
NAVKARURB|Navkarurb|Other|equity|11
FCONSUMER|Fconsumer|Other|equity|11
MIDCAPADD|Midcapadd|Other|equity|11
SAHYADRI|Sahyadri Industries|Cement|equity|11
NAHARCAP|Nahar Capital & Financial Services|Other|equity|11
SHAHALLOYS|Shah Alloys|Metals|equity|11
MAGNUM|Magnum Ventures|Industrials|equity|11
HDFCNIF100|Hdfcnif100|Other|equity|11
SILINV|SIL Investments|Textiles|equity|11
RAMANEWS|Shree Rama Newsprint|Industrials|equity|11
SHIVASHRIT|Shivashrit|Other|sme|11
CURIS|Curis|Other|sme|11
IPSL|Ipsl|Other|sme|11
ALUWIND|Aluwind|Other|sme|11
SENSEXETF|Sensexetf|Other|equity|11
CORALFINAC|Coral India Finance & Housing|Financial Services|equity|11
SALSTEEL|S.a.l.steel|Metals|equity|11
ARIHANTACA|Arihantaca|Other|sme|11
PASHUPATI|Pashupati|Other|equity|11
SHIVATEX|Shivatex|Other|equity|11
BANKBETF|Bankbetf|Other|equity|11
KALYANIFRG|Kalyani Forge|Auto Ancillary|equity|11
BEDMUTHA|Bedmutha Industries|Metals|equity|11
DELTIC|Deltic|Other|sme|11
CONSUMER|Consumer|Other|equity|11
REXPIPES|Rexpipes|Other|sme|11
LAMBODHARA|Lambodhara Textiles|Textiles|equity|11
HISARMETAL|Hisarmetal|Other|equity|11
VAL30IETF|Val30ietf|Other|equity|11
AXISTECETF|Axistecetf|Other|equity|11
BEARDSELL|Beardsell|Other|equity|11
MHLXMIRU|Mahalaxmi Rubtech|Other|equity|11
EMMIL|Emmil|Other|sme|11
INDBANK|Indbank Merchant Banking Services|Financial Services|equity|11
AONETMMQ50|Aonetmmq50|Other|equity|11
WORTHPERI|Worthperi|Other|equity|11
SINTERCOM|Sintercom|Other|equity|11
BANKETF|Banketf|Other|equity|11
DIVINEHIRA|Divinehira|Other|sme|10
LOTUSEYE|Lotus EYE Care Hospital|Pharma|equity|10
VALIANT-RE|Valiant RE|Other|equity|10
ROXHITECH|Roxhitech|Other|sme|10
DIGIKORE|Digikore|Other|sme|10
PRUDMOULI|Prudmouli|Other|equity|10
ENSER|Enser|Other|sme|10
LICNETFGSC|Licnetfgsc|Other|equity|10
AGRITECH|Agri- Tech (India)|Other|equity|10
CHETANA|Chetana|Other|sme|10
MOM50|Mom50|Other|equity|10
QNIFTY|Quantum Mutual Fund - Quantum Index Fund ETF|Financial Services|equity|10
GANGAFORGE|Gangaforge|Other|equity|10
SHEEL|Sheel|Other|sme|10
TIRUPATI|Tirupati|Other|sme|10
BANKA|Banka|Other|equity|10
KANORICHEM|Kanoria Chemicals & Industries|Chemicals|equity|10
MIDQ50ADD|Midq50add|Other|equity|10
MANORG|Mangalam Organics|Chemicals|equity|10
DOLLEX|Dollex Industries|FMCG|sme|10
MITCON|Mitcon|Other|equity|10
HECPROJECT|Hecproject|Other|equity|10
MANUFGBEES|Manufgbees|Other|equity|10
VEEKAYEM|Veekayem|Other|sme|10
TRUST|Trust|Other|sme|10
JHS|JHS|Other|equity|10
MCON|Mcon|Other|sme|10
SAMPANN|Sampann|Other|equity|10
BIRDYS|Birdys|Other|sme|10
TOUCHWOOD|Touchwood|Other|equity|10
BANARBEADS|Banaras Beads|Textiles|equity|10
EFACTOR|Efactor|Other|sme|10
ARUNAYA|Arunaya|Other|sme|10
HALEOSLABS|Haleoslabs|Other|equity|10
PRAXIS|Praxis|Other|equity|10
USHAFIN|Ushafin|Other|sme|10
KLL|KLL|Other|sme|10
APEXECO|Apexeco|Other|sme|9
CLSL|Clsl|Other|sme|9
INTERNET|Internet|Other|equity|9
UNITEDTEA|Unitedtea|Other|equity|9
BANKETFADD|Banketfadd|Other|equity|9
JTEKT-RE|Jtekt RE|Other|equity|9
AGSTRA|Agstra|Other|equity|9
BBTCL|Bbtcl|Other|equity|9
PRITI|Priti|Other|equity|9
TOKYOPLAST|Tokyo Plast International|Chemicals|equity|9
CCHHL|Country Club Hospitality & Holidays|Hospitality|equity|9
SHRITECH|Shritech|Other|sme|9
QMSMEDI|Qmsmedi|Other|equity|9
GENCON|Gencon|Other|equity|9
SVLL|Svll|Other|equity|9
HPIL|Hpil|Other|equity|9
INM|INM|Other|sme|9
SMSLIFE|Smslife|Other|equity|9
JINDALPHOT|Jindal Photo|Other|equity|9
NEWJAISA|Newjaisa|Other|sme|9
RELIABLE|Reliable|Other|equity|9
MADHUSUDAN|Madhusudan|Other|sme|9
JMA|JMA|Other|equity|9
DIGIDRIVE|Digidrive|Other|equity|9
AKANKSHA|Akanksha|Other|sme|9
CPCAP|Cpcap|Other|equity|9
DRCSYSTEMS|Drcsystems|Other|equity|9
GOYALSALT|Goyalsalt|Other|sme|9
SREEL|Sreeleathers|Textiles|equity|9
AARVI|Aarvi|Other|equity|9
NIRAJ|Niraj Cement Structurals|Infrastructure|equity|9
SEJALLTD|Sejalltd|Other|equity|9
XELPMOC|Xelpmoc|Other|equity|9
GKWLIMITED|Gkwlimited|Other|equity|9
ACCPL|Accpl|Other|sme|9
MODINATUR|Modi Naturals|Other|equity|9
ARVINDPORT|Arvindport|Other|sme|9
SBIETFPB|Sbietfpb|Other|equity|9
RELCHEMQ|Reliance Chemotex Industries|Textiles|equity|9
LAGNAM|Lagnam|Other|equity|8
SRGHFL|SRG Housing Finance|Financial Services|equity|8
CLASSICEIL|Classiceil|Other|sme|8
NDLVENTURE|Ndlventure|Other|equity|8
SURYALAXMI|Suryalakshmi Cotton Mills|Textiles|equity|8
NATCAPSUQ|Natural Capsules|Pharma|equity|8
DCG|DCG|Other|sme|8
DGCONTENT|Dgcontent|Other|equity|8
SUNDARAM|Sundaram Multi PAP|Media|equity|8
BLUEPEBBLE|Bluepebble|Other|sme|8
KAKATCEM|Kakatiya Cement Sugar & Industries|Cement|equity|8
INSPIRISYS|Inspirisys|Other|equity|8
ASPINWALL|Aspinwall|Other|equity|8
SONUINFRA|Sonuinfra|Other|sme|8
INFINIUM|Infinium|Other|sme|8
GLOBALPET|Globalpet|Other|sme|8
KEN|KEN|Other|sme|8
DTIL|Dtil|Other|equity|8
RADIOCITY|Radiocity|Other|equity|8
VDEAL|Vdeal|Other|sme|8
ALKALI|Alkali Metals|Chemicals|equity|8
SADHAV|Sadhav|Other|sme|8
SAH|SAH|Other|equity|8
COMPUSOFT|Compucom Software|Services|equity|8
PEARLPOLY|Pearl Polymers|Industrials|equity|8
SADBHIN|Sadbhin|Other|equity|8
HDFCBSE500|Hdfcbse500|Other|equity|8
AARADHYA|Aaradhya|Other|sme|8
PRATHAM|Pratham|Other|sme|8
MYMUDRA|Mymudra|Other|sme|8
ARHAM|Arham|Other|sme|8
BAGFILMS|B.a.g.films & Media|Media|equity|8
NITIRAJ|Nitiraj|Other|equity|8
APCL|Anjani Portland Cement|Cement|equity|8
SEMAC|Semac|Other|equity|8
ANMOL|Anmol|Other|equity|8
ARSSINFRA|Arss Infrastructure Projects|Infrastructure|equity|8
EMKAYTOOLS|Emkaytools|Other|sme|8
TTL-RE|TTL RE|Other|equity|8
HINDCON|Hindcon|Other|equity|8
AHLADA|Ahlada|Other|equity|8
CELEBRITY|Celebrity Fashions|Textiles|equity|8
SIDDHICOTS|Siddhicots|Other|sme|8
MAITREYA|Maitreya|Other|sme|7
ABSLNN50ET|Abslnn50et|Other|equity|7
MKPL|Mkpl|Other|equity|7
ROYALARC|Royalarc|Other|sme|7
SBGLP|Sbglp|Other|equity|7
HEXATRADEX|Hexa Tradex|Retail|equity|7
BANKPSU|Bankpsu|Other|equity|7
HVAX|Hvax|Other|sme|7
KEL|KEL|Other|sme|7
AIROLAM|Airolam|Other|equity|7
VIGOR|Vigor|Other|sme|7
SELECTIPO|Selectipo|Other|equity|7
SUPERHOUSE|Superhouse|Textiles|equity|7
RVHL|Rvhl|Other|equity|7
MUKTAARTS|Mukta Arts|Media|equity|7
RVTH|Rvth|Other|equity|7
KOTHARIPRO|Kothari Products|Retail|equity|7
ZODIACLOTH|Zodiac Clothing Co.ltd|Textiles|equity|7
FIDEL|Fidel|Other|sme|7
MARALOVER|Maral Overseas|Textiles|equity|7
HDFCVALUE|Hdfcvalue|Other|equity|7
MAHESHWARI|Maheshwari|Other|equity|7
HBSL|Hbsl|Other|equity|7
ODIGMA|Odigma|Other|equity|7
SMARTLINK|Smartlink Network Systems|Other|equity|7
GAYAPROJ|Gayatri Projects|Infrastructure|equity|7
MARCO|Marco|Other|sme|7
NEOCHEM|Neochem|Other|sme|7
PARAGON|Paragon|Other|sme|7
GATECHDVR|Gatechdvr|Other|equity|7
JETFREIGHT|Jetfreight|Other|equity|7
MOLOWVOL|Molowvol|Other|equity|7
PRESSTONIC|Presstonic|Other|sme|7
ASIANHOTNR|Asian Hotels (North)|Hospitality|equity|7
CPS|CPS|Other|sme|7
ROCKINGDCE|Rockingdce|Other|sme|7
ZENITHSTL|Zenithstl|Other|equity|7
AROGRANITE|ARO Granite Industries|Infrastructure|equity|7
NEXT50ETF|Next50etf|Other|equity|7
VIJIFIN|Vijifin|Other|equity|7
PATTECH|Pattech|Other|sme|7
GRETEX|Gretex|Other|sme|7
SATECH|Satech|Other|sme|7
RAJPUTANA|Rajputana Investment and Finance|Financial Services|sme|7
CALSOFT|California Software Co.ltd|IT|equity|7
ELDEHSG|Eldeco Housing & Industries|Real Estate|equity|7
AKSHAR|Akshar|Other|equity|7
JFLLIFE|Jfllife|Other|sme|6
ENERGYDEV|Energy Development Company|Power|equity|6
IDEALTECHO|Idealtecho|Other|sme|6
JEYYAM|Jeyyam|Other|sme|6
NIFTYBETF|Niftybetf|Other|equity|6
PSRAJ|Psraj|Other|sme|6
ITADD|Itadd|Other|equity|6
MDL|MDL|Other|sme|6
AKG|AKG|Other|equity|6
STUDIOLSD|Studiolsd|Other|sme|6
HMT|HMT|Automobile|equity|6
MOMENTUM30|Momentum30|Other|equity|6
MID150|Mid150|Other|equity|6
TROM|Trom|Other|sme|6
AXISBPSETF|Axisbpsetf|Other|equity|6
SAJHOTELS|Sajhotels|Other|sme|6
SIL|Standard Industries|Chemicals|equity|6
SUVIDHAA|Suvidhaa|Other|equity|6
MAXPOSURE|Maxposure|Other|sme|6
JISLDVREQS|Jain Irrigation Systems|Chemicals|equity|6
SILVER360|Silver360|Other|equity|6
MANOMAY|Manomay|Other|equity|6
SILKFLEX|Silkflex|Other|sme|6
ANIKINDS|Anik Industries|Other|equity|6
SUPERSPIN|Super Spinning Mills|Textiles|equity|6
PRANIK|Pranik|Other|sme|6
JAIPURKURT|Jaipurkurt|Other|equity|6
RKDL|Ravi Kumar Distilleries|FMCG|equity|6
MALUPAPER|Malu Paper Mills|Industrials|equity|6
PSFL|Psfl|Other|sme|6
HDIL|Housing Development & Infrastructure|Real Estate|equity|6
VLINFRA|Vlinfra|Other|sme|6
COMMITTED|Committed|Other|sme|6
TOTAL|Total|Other|equity|6
SONAMAC|Sonamac|Other|sme|6
WAAREEINDO|Waareeindo|Other|equity|6
AMDIND|AMD Industries|Other|equity|6
AMEYA|Ameya|Other|sme|6
IBLFL|Iblfl|Other|sme|6
BLBLIMITED|BLB|Financial Services|equity|6
DESTINY|Destiny|Other|sme|6
S&SPOWER|S & Spower|Other|equity|6
VIAZ|Viaz|Other|sme|6
SBINEQWETF|Sbineqwetf|Other|equity|6
GOYALALUM|Goyalalum|Other|equity|6
BANG|Bang Overseas|Textiles|equity|6
GROWWLOVOL|Growwlovol|Other|equity|6
BAWEJA|Baweja|Other|sme|5
MAHAPEXLTD|Maha Rashtra Apex Corporation|Financial Services|equity|5
MAHICKRA|Mahickra|Other|sme|5
TPHQ|Tphq|Other|equity|5
IPHL|Iphl|Other|sme|5
ELGIRUBCO|Elgirubco|Other|equity|5
MEDISTEP|Medistep|Other|sme|5
KSHITIJPOL|Kshitijpol|Other|equity|5
TARAPUR|Tarapur Transformers|Capital Goods|equity|5
PULZ|Pulz|Other|sme|5
ZEAL|Zeal|Other|sme|5
ASTEC-RE|Astec RE|Other|equity|5
RILINFRA|Rilinfra|Other|sme|5
SIDDHIKA|Siddhika|Other|sme|5
NAMAN|Naman|Other|sme|5
BANKADD|Bankadd|Other|equity|5
CHAMUNDA|Chamunda|Other|sme|5
SBIETFCON|Sbietfcon|Other|equity|5
MASTER|Master|Other|sme|5
SCML|Scml|Other|sme|5
VIJAYPD|Vijaypd|Other|sme|5
OSWALSEEDS|Oswalseeds|Other|equity|5
LFIC|Lfic|Other|equity|5
GROWWNXT50|Growwnxt50|Other|equity|5
ZENITHDRUG|Zenithdrug|Other|sme|5
SYLVANPLY|Sylvanply|Other|sme|5
DIL|DIL|Pharma|equity|5
TAKE|Take Solutions|IT|equity|5
AXISBNKETF|Axisbnketf|Other|equity|5
DHANLAXMI|Dhanlaxmi|Other|sme|5
SOCL|Socl|Other|sme|5
AXISVALUE|Axisvalue|Other|equity|5
PENTAGON|Pentagon|Other|sme|5
RULKA|Rulka|Other|sme|5
RADIOWALLA|Radiowalla|Other|sme|5
SEL|SEL|Other|sme|5
RUCHINFRA|Ruchi Infrastructure|FMCG|equity|5
AKI|AKI|Other|equity|5
MRIL|Mril|Other|sme|5
PVTBANKADD|Pvtbankadd|Other|equity|5
AXISHCETF|Axishcetf|Other|equity|5
SECURKLOUD|Securkloud|Other|equity|5
SILLYMONKS|Sillymonks|Other|equity|5
ARABIAN|Arabian|Other|sme|5
XTGLOBAL|Xtglobal|Other|equity|5
DBSTOCKBRO|DB (international) Stock Brokers|Financial Services|equity|5
ORIENTLTD|Orient Press|Industrials|equity|5
TOP20|Top20|Other|equity|5
FONEBOX|Fonebox|Other|sme|5
SFML|Sfml|Other|sme|5
IDENTICAL|Identical|Other|sme|5
NDGL|Ndgl|Other|equity|5
NIFITETF|Nifitetf|Other|equity|5
DUGLOBAL|Duglobal|Other|sme|5
PAR|PAR|Other|equity|5
ADROITINFO|Adroitinfo|Other|equity|5
RAPIDFLEET|Rapidfleet|Other|sme|5
RAJRILTD|Rajriltd|Other|equity|5
VINNY|Vinny|Other|equity|5
UNIVPHOTO|Univphoto|Other|equity|5
ESG|ESG|Other|equity|5
SBIETFQLTY|Sbietfqlty|Other|equity|5
LLOYDS|Lloyds|Other|sme|5
GIRIRAJ|Giriraj|Other|sme|5
KONTOR|Kontor|Other|sme|5
SMALLADD|Smalladd|Other|equity|5
HPTL|Hptl|Other|sme|4
NEXT50ADD|Next50add|Other|equity|4
TOP15IETF|Top15ietf|Other|equity|4
NGIL|Ngil|Other|equity|4
JOCIL|Jocil|Other|equity|4
SIGIND|Sigind|Other|equity|4
DECCANTRAN|Deccantran|Other|sme|4
IITL|Industrial Investment Trust|Financial Services|equity|4
REXPRO|Rexpro|Other|sme|4
EFORCE|Eforce|Other|sme|4
GANGESSECU|Gangessecu|Other|equity|4
KEYFINSERV|Keyfinserv|Other|equity|4
NOIDATOLL|Noida Toll Bridge Company|Infrastructure|equity|4
ASHOKAMET|Ashokamet|Other|equity|4
ATLASCYCLE|Atlas Cycles (haryana)|Automobile|equity|4
GRCL|Grcl|Other|sme|4
ASHALOG|Ashalog|Other|sme|4
LICNMID100|Licnmid100|Other|equity|4
MOHITIND|Mohit Industries|Textiles|equity|4
YAARI|Yaari|Other|equity|4
UNILEX|Unilex|Other|sme|4
AISL|Aisl|Other|sme|4
DTL|DTL|Other|sme|4
LAXMICOT|Laxmicot|Other|equity|4
BAFNAPH|Bafnaph|Other|equity|4
ARISTO|Aristo|Other|sme|4
ONYX|Onyx|Other|sme|4
PIONEEREMB|Pioneer Embroideries|Textiles|equity|4
ABHAPOWER|Abhapower|Other|sme|4
HGM|HGM|Other|equity|4
ORCHASP|Orchasp|Other|equity|4
21STCENMGM|Twentyfirst Century Management Services|Financial Services|equity|4
DNAMEDIA|Dnamedia|Other|equity|4
KATARIA|Kataria|Other|sme|4
PURVFLEXI|Purvflexi|Other|sme|4
ANTGRAPHIC|Antgraphic|Other|equity|4
GOLDKART|Goldkart|Other|sme|4
SBIBPB|Sbibpb|Other|equity|4
DHRUV|Dhruv|Other|equity|4
PARTYCRUS|Partycrus|Other|sme|4
BRACEPORT|Braceport|Other|sme|4
GOLD360|Gold360|Other|equity|4
CRAYONS|Crayons|Other|sme|4
GOLDSTAR|Goldstar|Other|sme|4
GURUNANAK|Gurunanak|Other|sme|4
MOXSH|Moxsh|Other|sme|4
PALASHSECU|Palashsecu|Other|equity|4
KONSTELEC|Konstelec|Other|sme|4
SHRENIK|Shrenik|Other|equity|4
NETF|Netf|Other|equity|4
LRRPL|Lrrpl|Other|sme|4
BALKRISHNA|Balkrishna|Other|equity|4
SECL|Secl|Other|sme|4
MOGSEC|Mogsec|Other|equity|4
HOLMARC|Holmarc|Other|sme|4
KHFM|Khfm|Other|sme|4
TEAMGTY|Teamgty|Other|equity|4
GREENCHEF|Greenchef|Other|sme|4
FMNL|Future Market Networks|Other|equity|4
HEADSUP|Headsup|Other|equity|4
VIVIMEDLAB|Vivimed Labs|Pharma|equity|4
RETAIL|Retail|Other|equity|4
VR|VR|Other|sme|4
MEGAFLEX|Megaflex|Other|sme|4
VINEETLAB|Vineetlab|Other|equity|4
SHEKHAWATI|Shekhawati|Other|equity|4
NEELAM|Neelam|Other|sme|4
FALCONTECH|Falcontech|Other|sme|4
MIDCAPBETA|Midcapbeta|Other|equity|4
SNXT50BETA|Snxt50beta|Other|equity|4
UMA|UMA|Other|sme|4
DURLAX|Durlax|Other|sme|3
PPSL|Ppsl|Other|sme|3
TGBHOTELS|TGB Banquets AND Hotels|Hospitality|equity|3
PARASPETRO|Paras Petrofils|Textiles|equity|3
MADHAV|Madhav Marbles & Granites|Infrastructure|equity|3
VCL|VCL|Other|equity|3
WEIZMANIND|Weizmann|Retail|equity|3
GRAPHISAD|Graphisad|Other|sme|3
MEDIORG|Mediorg|Other|sme|3
VISHWAS|Vishwas|Other|sme|3
VITAL|Vital|Other|equity|3
LIBAS|Libas|Other|equity|3
ONDOOR|Ondoor|Other|sme|3
SYNOPTICS|Synoptics|Other|sme|3
HINDNATGLS|Hindusthan National Glass & Industries|Industrials|equity|3
SAMBHAAV|Sambhaav Media|Media|equity|3
SETCO|Setco Automotive|Auto Ancillary|equity|3
CINEVISTA|Cinevista|Media|equity|3
PARAMATRIX|Paramatrix|Other|sme|3
SALONA|Salona|Other|equity|3
AUSL|Ausl|Other|sme|3
SERVICE|Service|Other|sme|3
SHANTI|Shanti|Other|equity|3
NIBL|NRB Industrial Bearings|Other|equity|3
WIPL|Wipl|Other|equity|3
KALANA|Kalana|Other|sme|3
CEREBRAINT|Cerebra Integrated Technologies|IT|equity|3
DANGEE|Dangee|Other|equity|3
GSEC10IETF|Gsec10ietf|Other|equity|3
ROML|Roml|Other|equity|3
AMBICAAGAR|Ambicaagar|Other|equity|3
AUROIMPEX|Auroimpex|Other|sme|3
DELTAMAGNT|Delta Magnets|Other|equity|3
KANANIIND|Kanani Industries|Textiles|equity|3
SKIL|Skyline Ventures India|Real Estate|equity|3
PREMIUM|Premium|Other|sme|3
AMBEY|Ambey|Other|sme|3
SAGARDEEP|Sagardeep|Other|equity|3
SPEB|Speb|Other|sme|3
GSEC5IETF|Gsec5ietf|Other|equity|3
AGARWALFT|Agarwalft|Other|sme|3
GVPTECH-RE|Gvptech RE|Other|equity|3
SPECTSTM|Spectstm|Other|sme|3
KILITC-RE|Kilitc RE|Other|equity|3
EQUIPPP|Equippp|Other|equity|3
SOTAC|Sotac|Other|sme|3
WELINV|Welspun Investments AND Commercials|Financial Services|equity|3
OBCL|Obcl|Other|equity|3
CONS|Cons|Other|equity|3
KHAITANLTD|Khaitan (india)|Retail|equity|3
HOMESFY|Homesfy|Other|sme|3
SRIVASAVI|Srivasavi|Other|sme|3
BSL|BSL|Textiles|equity|3
GSEC10YEAR|Gsec10year|Other|equity|3
PROPEQUITY|Propequity|Other|sme|3
LICNETFN50|Licnetfn50|Other|equity|3
VERITAAS|Veritaas|Other|sme|3
3PLAND|3pland|Other|equity|3
AXISCETF|Axiscetf|Other|equity|3
NIFTY100EW|Nifty100ew|Other|equity|3
TVVISION|Tvvision|Other|equity|3
AURDIS|Aurdis|Other|sme|3
LAMOSAIC|Lamosaic|Other|sme|3
SNXT30BEES|Snxt30bees|Other|equity|3
AMBANIORGO|Ambaniorgo|Other|sme|3
IL&FSENGG|IL & Fsengg|Other|equity|3
CYBERMEDIA|Cyber Media (india)|Media|equity|3
MAGSON|Magson|Other|sme|3
PKTEA|Pktea|Other|equity|3
ARCHIES|Archies|Other|equity|3
BINANIIND|Binani Industries|Financial Services|equity|3
MOQUALITY|Moquality|Other|equity|3
AGNI|Agni|Other|sme|3
ITBETA|Itbeta|Other|equity|3
LPDC|Landmark Property Development Company|Real Estate|equity|3
MSCIINDIA|Msciindia|Other|equity|3
BABAFP|Babafp|Other|sme|3
SVPGLOB|SVP Global Ventures|Retail|equity|3
DAMODARIND|Damodarind|Other|equity|3
SUNREST|Sunrest|Other|sme|3
BIOFILCHEM|Biofil Chemicals & Pharmaceuticals|Pharma|equity|3
INSPIRE|Inspire|Other|sme|3
ASTRON|Astron|Other|equity|3
UTISXN50|Utisxn50|Other|equity|3
COUNCODOS|Country Condo's|Real Estate|equity|3
ASLIND|Aslind|Other|sme|3
GAYAHWS|Gayahws|Other|equity|3
DIVIDEND|Dividend|Other|equity|3
NEUEON|Neueon|Other|equity|3
SANGANI|Sangani|Other|sme|3
CONTI|Conti|Other|sme|3
NIFMID150|Nifmid150|Other|equity|3
CTE|Cambridge Technology Enterprises|IT|equity|2
SDL26BEES|Sdl26bees|Other|equity|2
VIVIDHA|Visagar Polytex|Textiles|equity|2
TREEHOUSE|Tree House Education & Accessories|Services|equity|2
LEXUS|Lexus|Other|equity|2
SWASTIK|Swastik|Other|sme|2
VISASTEEL|Visa Steel|Metals|equity|2
MHHL|Mhhl|Other|sme|2
INTEGRITY|Integrity|Other|sme|2
TIMESCAN|Timescan|Other|sme|2
DEEM|Deem|Other|sme|2
PROV|Prov|Other|sme|2
HRHNEXT|Hrhnext|Other|sme|2
BOSS|Boss|Other|sme|2
KARMAENG|Karma Energy|Power|equity|2
MOTOUR|Motour|Other|equity|2
CURRENT|Current|Other|sme|2
SICALLOG|Sicallog|Other|equity|2
AMIABLE|Amiable|Other|sme|2
ROLTA|Rolta India|IT|equity|2
TFL|Transwarranty Finance|Financial Services|equity|2
LAL|LAL|Other|equity|2
MOTOGENFIN|Motor & General Finance|Financial Services|equity|2
ARCIIL|Arciil|Other|sme|2
DIVYADHAN|Divyadhan|Other|sme|2
MPTODAY|Mptoday|Other|sme|2
CMRSL|Cmrsl|Other|sme|2
SAIFL|Saifl|Other|sme|2
LOYALTEX|Loyal Textile Mills|Textiles|equity|2
PERFECT|Perfect|Other|sme|2
SPRL|Sprl|Other|sme|2
BMETRICS|Bmetrics|Other|sme|2
REGENCERAM|Regency Ceramics|Paints|equity|2
SATIPOLY|Satipoly|Other|sme|2
SIMBHALS|Simbhals|Other|equity|2
TNTELE|Tamilnadu Telecommunications|Telecom|equity|2
DKEGL|Dkegl|Other|sme|2
GROWWMC150|Growwmc150|Other|equity|2
SENSEXADD|Sensexadd|Other|equity|2
AUSOMENT|AuSom Enterprise|Retail|equity|2
LASA|Lasa|Other|equity|2
MIEL|Miel|Other|sme|2
REFRACTORY|Refractory|Other|sme|2
MOGOLD|Mogold|Other|equity|2
THESL|Thesl|Other|sme|2
KHANDSE|Khandwala Securities|Financial Services|equity|2
USASEEDS|Usaseeds|Other|sme|2
ACTIVEINFR|Activeinfr|Other|sme|2
BULKCORP|Bulkcorp|Other|sme|2
SIGNORIA|Signoria|Other|sme|2
UCL|UCL|Other|sme|2
PLADAINFO|Pladainfo|Other|sme|2
AGUL|Agul|Other|sme|2
QUICKTOUCH|Quicktouch|Other|sme|2
ALCODIS|Alcodis|Other|sme|2
ARSHIYA|Arshiya|Logistics|equity|2
NEXT30ADD|Next30add|Other|equity|2
AVSL|Avsl|Other|sme|2
PALREDTEC|Palredtec|Other|equity|2
SANGINITA|Sanginita|Other|equity|2
SELMC|Selmc|Other|equity|2
WALPAR|Walpar|Other|sme|2
TIJARIA|Tijaria Polypipes|Chemicals|equity|2
ASPIRE|Aspire|Other|sme|2
HOVS|HOV Services|IT|equity|2
RCDL|Rcdl|Other|sme|2
ISHAN|Ishan|Other|sme|2
SECMARK|Secmark|Other|equity|2
KREBSBIO|Krebs Biochemicals & Industries|Pharma|equity|2
SHIVAMILLS|Shivamills|Other|equity|2
WEWIN|Wewin|Other|equity|2
DHTL|Dhtl|Other|sme|2
SAROJA|Saroja|Other|sme|2
QFIL|Qfil|Other|sme|2
SRPL|Srpl|Other|equity|2
AKASH|Akash|Other|equity|2
TCIFINANCE|TCI Finance|Financial Services|equity|2
GILT5BETA|Gilt5beta|Other|equity|2
NAGREEKEXP|Nagreeka Exports|Textiles|equity|2
SURANI|Surani|Other|sme|2
SHYAMCENT|Shyamcent|Other|equity|2
SUULD|Suuld|Other|equity|2
PHOGLOBAL|Phoglobal|Other|sme|2
DRL|DRL|Other|sme|2
FLEXITUFF|Flexituff International|Chemicals|equity|2
MONIFTY100|Monifty100|Other|equity|2
SHANTHALA|Shanthala|Other|sme|2
EQUAL200|Equal200|Other|equity|2
MONOPHARMA|Monopharma|Other|sme|2
ARVEE|Arvee|Other|equity|2
TRIDHYA|Tridhya|Other|sme|2
HDFCLOWVOL|Hdfclowvol|Other|equity|2
BBNPPGOLD|Bbnppgold|Other|equity|2
VERTEXPLUS|Vertexplus|Other|sme|2
IDFNIFTYET|Idfniftyet|Other|equity|2
RICHA|Richa|Other|sme|2
WILLAMAGOR|Williamson Magor & Company|Retail|equity|2
PARAMOUNT|Paramount|Other|sme|2
SANWARIA|Sanwaria Agro Oils|FMCG|equity|2
SITINET|Sitinet|Other|equity|2
BIKEWO|Bikewo|Other|sme|2
DIGJAMLMTD|Digjamlmtd|Other|equity|2
MOALPHA50|Moalpha50|Other|equity|2
VELS|Vels|Other|sme|2
LICNFNHGP|Licnfnhgp|Other|equity|2
ZENITHEXPO|Zenith Exports|Textiles|equity|2
ASCOM|Ascom|Other|sme|2
SWANDEF|Swandef|Other|equity|2
LCCINFOTEC|Lccinfotec|Other|equity|1
ROLLT|Rollatainers|Industrials|equity|1
LYPSAGEMS|Lypsa Gems & Jewellery|Textiles|equity|1
ARTNIRMAN|Artnirman|Other|equity|1
GSTL|Gstl|Other|sme|1
HEALTHADD|Healthadd|Other|equity|1
ITALIANE|Italiane|Other|sme|1
MODIRUBBER|Modi Rubber|Auto Ancillary|equity|1
GLOBALE|Globale|Other|equity|1
FSC|FSC|Other|equity|1
KORE|Kore|Other|sme|1
PRAXIS-RE2|Praxis RE2|Other|equity|1
UWCSL|Uwcsl|Other|sme|1
HALDER|Halder|Other|equity|1
QVCEL|Qvcel|Other|sme|1
NPBET|Npbet|Other|equity|1
NMSTEEL|Nmsteel|Other|sme|1
IL&FSTRANS|IL & Fstrans|Other|equity|1
UNIONGOLD|Uniongold|Other|equity|1
CADSYS|Cadsys|Other|sme|1
SHIGAN|Shigan|Other|sme|1
YCCL|Yccl|Other|sme|1
VSCL|Vscl|Other|sme|1
RADAAN|Radaan Mediaworks (i)|Media|equity|1
BSLSENETFG|Bslsenetfg|Other|equity|1
MARSHALL|Marshall|Other|equity|1
MILTON|Milton|Other|sme|1
GUJRAFFIA|Gujraffia|Other|equity|1
MFML|Mfml|Other|equity|1
MONEXT50|Monext50|Other|equity|1
AILIMITED|Ailimited|Other|sme|1
IVZINNIFTY|Ivzinnifty|Other|equity|1
MANUGRAPH|Manugraph India|Capital Goods|equity|1
CBAZAAR|Cbazaar|Other|sme|1
MOINFRA|Moinfra|Other|equity|1
KKVAPOW|Kkvapow|Other|sme|1
MADHUCON|Madhucon Projects|Infrastructure|equity|1
BALCO|Balco|Other|sme|1
VILINBIO|Vilinbio|Other|sme|1
AXSENSEX|Axsensex|Other|equity|1
GAJANAND|Gajanand|Other|sme|1
JIWANRAM|Jiwanram|Other|sme|1
RAJTV|RAJ Television Network|Media|equity|1
TAPIFRUIT|Tapifruit|Other|sme|1
KRIDHANINF|Kridhaninf|Other|equity|1
PRECISION|Precision Containeurs|Retail|sme|1
NAGREEKCAP|Nagreeka Capital & Infrastructure|Other|equity|1
ACEINTEG|Aceinteg|Other|equity|1
LOWVOL|Lowvol|Other|equity|1
MICROPRO|Micropro|Other|sme|1
JALAN|Jalan|Other|sme|1
MEP|MEP Infrastructure Developers|Infrastructure|equity|1
SPLIL|SPL Industries|Textiles|equity|1
MANDEEP|Mandeep|Other|sme|1
MINDPOOL|Mindpool|Other|sme|1
PROLIFE|Prolife|Other|sme|1
INCREDIBLE|Incredible|Other|equity|1
VIVO|Vivo|Other|sme|1
MODTHREAD|Modthread|Other|equity|1
SEYAIND|Seyaind|Other|equity|1
CELLPOINT|Cellpoint|Other|sme|1
NORBTEAEXP|Norbteaexp|Other|equity|1
ANSALAPI|Ansal Properties & Infrastructure|Real Estate|equity|1
MOSERVICE|Moservice|Other|equity|1
MSCIADD|Msciadd|Other|equity|1
NIF5GETF|Nif5getf|Other|equity|1
UMESLTD|Usha Martin Education & Solutions|IT|equity|1
EQUAL50|Equal50|Other|equity|1
ENIFTY|Enifty|Other|equity|1
ONELIFECAP|Onelife Capital Advisors|Other|equity|1
SGL|STL Global|Textiles|equity|1
QUALITY30|Quality30|Other|equity|1
ACCORD|Accord|Other|sme|1
MANAV|Manav|Other|sme|1
VINEET-RE|Vineet RE|Other|equity|1
YUDIZ|Yudiz|Other|sme|1
DCMFINSERV|DCM Financial Services|Financial Services|equity|1
GML|GML|Other|sme|1
INDIFRA|Indifra|Other|sme|1
SHIVAUM|Shivaum|Other|equity|1
GILT10BETA|Gilt10beta|Other|equity|1
EXCELLENT|Excellent|Other|sme|1
SHUBHLAXMI|Shubhlaxmi|Other|sme|1
NIDAN|Nidan|Other|sme|1
AATMAJ|Aatmaj|Other|sme|1
ARMOUR|Armour|Other|sme|1
GFSTEELS|Gfsteels|Other|equity|1
QUADPRO|Quadpro|Other|sme|1
BGLOBAL|Bharatiya Global Infomedia|IT|equity|1
WINNY|Winny|Other|sme|1
ARENTERP|Rajdarshan Industries|Infrastructure|equity|1
HYBRIDFIN|Hybridfin|Other|equity|1
PNC|Pritish Nandy Communications|Media|equity|1
SABAR|Sabar|Other|sme|1
AMJUMBO|Amjumbo|Other|sme|1
CREATIVEYE|Creative EYE|Media|equity|1
SPPPOLY|Spppoly|Other|sme|1
KALYANI|Kalyani|Other|equity|1
MARINETRAN|Marinetran|Other|sme|1
GROBTEA|Grobtea|Other|equity|1
TRANSWIND|Transwind|Other|sme|1
MORARJEE|Morarjee Textiles|Textiles|equity|1
HAVISHA|Havisha|Other|equity|1
SUPREMEENG|Supremeeng|Other|equity|1
KEEPLEARN|Keeplearn|Other|equity|1
ORTINGLOBE|Ortinglobe|Other|equity|1
INFOMEDIA|Infomedia Press|Media|equity|1
LICNETFSEN|Licnetfsen|Other|equity|1
SMVD|Smvd|Other|sme|1
GOENKA|Goenka Diamond & Jewels|Textiles|equity|1
MON50EQUAL|Mon50equal|Other|equity|1
NEXTMEDIA|Next Mediaworks|Media|equity|1
SABEVENTS|Sabevents|Other|equity|1
ABGSEC|Abgsec|Other|equity|1
EDUCOMP|Educomp Solutions|Services|equity|1
MAKS|Maks|Other|sme|1
UNIINFO|Uniinfo|Other|equity|1
MTEDUCARE|MT Educare|Services|equity|1
ICDSLTD|Icdsltd|Other|equity|0
ADL|ADL|Other|equity|0
ANKITMETAL|Ankit Metal & Power|Metals|equity|0
FEL|FEL|Other|equity|0
RITEZONE|Ritezone|Other|sme|0
BBNPNBETF|Bbnpnbetf|Other|equity|0
SAHAJ|Sahaj|Other|sme|0
MOPSE|Mopse|Other|equity|0
UNIVAFOODS|Univafoods|Other|equity|0
COMPINFO|Compinfo|Other|equity|0
VASA|Vasa|Other|sme|0
BILVYAPAR|Bilvyapar|Other|equity|0
EBANKNIFTY|Ebanknifty|Other|equity|0
MOMGF|Momgf|Other|equity|0
MOIPO|Moipo|Other|equity|0
MOMNC|Momnc|Other|equity|0
NIF10GETF|Nif10getf|Other|equity|0
SHYAMTEL|Shyam Telecom|Telecom|equity|0
GOLDENTOBC|Golden Tobacco|FMCG|equity|0
PANSARI|Pansari|Other|equity|0
EUROTEXIND|Eurotex Industries & Exports|Textiles|equity|0
FLFL|Future Lifestyle Fashions|Other|equity|0
WINSOME|Winsome Yarns|Textiles|equity|0
BLUECOAST|Blue Coast Hotels|Hospitality|equity|0
OMKARCHEM|Omkar Speciality Chemicals|Chemicals|equity|0
ESENSEX|Esensex|Other|equity|0
NKIND|Nkind|Other|equity|0
QUINTEGRA|Quintegra Solutions|IT|equity|0
ALPSINDUS|Alps Industries|Textiles|equity|0
MASKINVEST|Maskinvest|Other|equity|0
PREMIER|Premier|Capital Goods|equity|0
CAPTRU-RE|Captru RE|Other|equity|0
IMPEXFERRO|Impex Ferro Tech|Metals|equity|0
SANCO|Sanco|Other|equity|0
GLFL|Gujarat Lease Financing|Financial Services|equity|0
TECILCHEM|Tecilchem|Other|equity|0
ABMINTLLTD|Abmintlltd|Other|equity|0
ITTL|Ittl|Other|sme|0
GSEC10ABSL|Gsec10absl|Other|equity|0
GTECJAINX|Gtecjainx|Other|equity|0
GANGOTRI|Gangotri Textiles|Textiles|equity|0
CMICABLES|Cmicables|Other|equity|0
SETUINFRA|Setuinfra|Other|equity|0
FELDVR|Feldvr|Other|equity|0
LAKPRE|Lakshmi Precision Screws|Metals|equity|0
BLUECHIP|Blue Chip India|Financial Services|equity|0
CURAA|Curaa|Other|equity|0
NIRAJISPAT|Nirajispat|Other|equity|0
ORTEL|Ortel Communications|Media|equity|0`;

function parse(): UniverseEntry[] {
  const out: UniverseEntry[] = [];
  for (const line of PACKED.split("\n")) {
    if (!line) continue;
    const [ticker, name, sector, kind, turnover] = line.split("|");
    if (!ticker) continue;
    out.push({
      symbol: `${ticker}.NS`,
      ticker,
      name: name || ticker,
      sector: sector || "Other",
      kind: (kind as SymbolKind) || "equity",
      turnoverLacs: Number(turnover) || 0,
    });
  }
  return out;
}

export const NSE_UNIVERSE: UniverseEntry[] = parse();

/** Lookup by bare ticker (`RELIANCE`) — uppercase keys. */
export const BY_TICKER = new Map(NSE_UNIVERSE.map((u) => [u.ticker, u]));

/** Lookup by Yahoo symbol (`RELIANCE.NS`) — uppercase keys. */
export const BY_SYMBOL = new Map(NSE_UNIVERSE.map((u) => [u.symbol, u]));
