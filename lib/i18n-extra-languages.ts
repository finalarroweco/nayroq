export const EXTRA_INTERFACE_LANGUAGES={
  sq:"Shqip",
  be:"Беларуская",
  bs:"Bosanski",
  ca:"Català",
  eu:"Euskara",
  fo:"Føroyskt",
  gl:"Galego",
  is:"Íslenska",
  ga:"Gaeilge",
  gd:"Gàidhlig",
  cy:"Cymraeg",
  lb:"Lëtzebuergesch",
  mk:"Македонски",
  mt:"Malti",
  me:"Crnogorski",
  rm:"Rumantsch",
  hy:"Հայերեն",
  ka:"ქართული"
}as const;
export type ExtraInterfaceLang=keyof typeof EXTRA_INTERFACE_LANGUAGES;
export const EXTRA_LANGUAGE_NAMES:Record<ExtraInterfaceLang,string>={
  sq:"Albanian",be:"Belarusian",bs:"Bosnian",ca:"Catalan",eu:"Basque",fo:"Faroese",gl:"Galician",is:"Icelandic",ga:"Irish",gd:"Scottish Gaelic",cy:"Welsh",lb:"Luxembourgish",mk:"Macedonian",mt:"Maltese",me:"Montenegrin",rm:"Romansh",hy:"Armenian",ka:"Georgian"
};
