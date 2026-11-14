import original from './catalog.json';
export type Lang='en'|'ar';
export type Badge={id:string;category:string;en:string;ar:string;requirements:{en:string;ar:string}[];source?:string};
export type BadgeProgress=Record<string,{checked:number[];notes:string;completed?:string}>;
export type Achievement={id:string;en:string;ar:string;date:string;description:string;image:string;photos:string[]};
export type Program={badges:Record<string,Partial<Badge>>;custom:Badge[];hidden:string[];handbook:Record<string,string>;achievements:Achievement[];events?:{id:string;title:string;date:string;details:string}[];archivedMeetingIds?:string[];attendanceDays?:string[];symbols:{icon:string;en:string;ar:string}[]};
export const initialProgram:Program={badges:{},custom:[],hidden:[],handbook:{},achievements:[],symbols:[]};
export const catalog:Badge[]=original;
export const categories={all:['All categories','كل الفئات'],rel:['Religious','دينية'],skill:['Skills','مهارية'],sport:['Sports','رياضية'],art:['Arts','فنية'],scout:['Scouting','كشفية']};
export const handbook=[
 {id:'promise',en:'Scout Promise',ar:'وعد الكشافة',text:{en:'On my honour and with God’s grace, I promise to do my best to do my duty to God and my country, to help people at all times, and to keep the Scout Law.',ar:'أعد بشرفي وبنعمة الله أن أبذل جهدي في أن أقوم بما يجب نحو الله والوطن، وأن أساعد الناس في جميع الظروف، وأن أعمل بقانون الكشافة.'}},
 {id:'law',en:'Scout Law',ar:'قانون الكشافة',text:{en:['Honest','Loyal','Useful','Friendly','Courteous','Kind','Obedient','Cheerful','Thrifty','Clean','Brave'].map((s,i)=>`${i+1}. ${s}`).join('\n'),ar:['صادق','مخلص','نافع','ودود','مؤدب','رفيق','مطيع','باش','مقتصد','نظيف','شجاع'].map((s,i)=>`${i+1}. ${s}`).join('\n')}},
 {id:'prayer',en:'Scout Prayer',ar:'صلاة الكشافة',text:{en:'Lord Jesus, teach me to be generous; to serve You as You deserve; never to stop at giving; to fight without caring for the wounds; to work without seeking rest; to give myself without looking for any reward but the certainty that I am doing Your holy will. Amen.',ar:'سيدي يسوع، علمني أن أكون سخياً، أن أخدمك كما يليق بك، ألا أقف في العطاء عند حد، أن أكافح غير مبالٍ بالجراح، أن أعمل ولا أطلب الراحة، أن أتفانى غير ناظر إلى أجر آخر سوى يقيني بأن أتمم مشيئتك القدوسة. آمين'}},
 {id:'signals',en:'Service signals',ar:'إشارات الخدمة',text:{en:'AAA · Call · .- .- .-\nCT · Message · -.-. -\nK · Ready · -.-\nAR · End · .- .-.\nUD · Understood · ..- -..\nMD · Slower · -- -..',ar:'AAA · نداء · .- .- .-\nCT · رسالة · -.-. -\nK · جاهز · -.-\nAR · نهاية · .- .-.\nUD · مفهوم · ..- -..\nMD · أبطأ · -- -..'}}
];
export const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function completion(b:Badge,p:BadgeProgress){return (p[b.id]?.checked||[]).filter(i=>i>=0&&i<b.requirements.length).length;}
