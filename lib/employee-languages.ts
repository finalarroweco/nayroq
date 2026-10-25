export const EMPLOYEE_LANGUAGES=[
["auto","Auto — detect customer language"],["ar","العربية"],["en","English"],["sq","Shqip"],["hy","Հայերեն"],["be","Беларуская"],["eu","Euskara"],["bs","Bosanski"],["bg","Български"],["ca","Català"],["hr","Hrvatski"],["cs","Čeština"],["da","Dansk"],["nl","Nederlands"],["et","Eesti"],["fo","Føroyskt"],["fi","Suomi"],["fr","Français"],["gl","Galego"],["ka","ქართული"],["de","Deutsch"],["el","Ελληνικά"],["hu","Magyar"],["is","Íslenska"],["ga","Gaeilge"],["gd","Gàidhlig"],["it","Italiano"],["lv","Latviešu"],["lt","Lietuvių"],["lb","Lëtzebuergesch"],["mk","Македонски"],["mt","Malti"],["me","Crnogorski"],["no","Norsk"],["pl","Polski"],["pt","Português"],["ro","Română"],["rm","Rumantsch"],["ru","Русский"],["sr","Srpski"],["sk","Slovenčina"],["sl","Slovenščina"],["es","Español"],["sv","Svenska"],["tr","Türkçe"],["uk","Українська"],["cy","Cymraeg"]
]as const;
export const ARABIC_DIALECTS=[
["neutral","neutralAuto"],["omani","omaniArabic"],["saudi","saudiArabic"],["emirati","emiratiArabic"],["kuwaiti","kuwaitiArabic"],["bahraini","bahrainiArabic"],["qatari","qatariArabic"],["gulf","gulfNeutral"],["msa","modernStandardArabic"]
]as const;
export const EMPLOYEE_VOICES=["alloy","ash","ballad","coral","echo","fable","nova","onyx","sage","shimmer"]as const;
const displayCode:Record<string,string>={me:"sr-ME"};
export function employeeLanguageLabel(code:string,interfaceLanguage:string,autoLabel:string){
  if(code==="auto")return autoLabel;
  try{const display=new Intl.DisplayNames([interfaceLanguage],{type:"language"});const label=display.of(displayCode[code]||code);if(label&&label!==code)return label}catch{}
  return EMPLOYEE_LANGUAGES.find(item=>item[0]===code)?.[1]||code;
}
export const languageLabel=(code:string)=>EMPLOYEE_LANGUAGES.find(x=>x[0]===code)?.[1]||code;
