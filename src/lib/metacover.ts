import sharp from "sharp";


function escapeXml(text:string){

  return text
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;");

}



function getFontSize(title:string){

  if(title.length <= 18){
    return 70;
  }

  if(title.length <= 28){
    return 55;
  }

  return 40;

}




export async function createMetaCover(
  imageUrl:string,
  brand:string,
  model:string,
  year:number,
  price:number
){


const imageBuffer =
await fetch(imageUrl)
.then(
  res=>res.arrayBuffer()
);




const title =
escapeXml(
  model.toUpperCase()
);




const svg = `

<svg width="1080" height="1080"
xmlns="http://www.w3.org/2000/svg">


<defs>


<linearGradient id="top"
x2="0"
y2="1">

<stop offset="0"
stop-color="black"
stop-opacity="0.75"/>

<stop offset="1"
stop-color="black"
stop-opacity="0"/>

</linearGradient>


<linearGradient id="bottom"
x2="0"
y2="1">

<stop offset="0"
stop-color="black"
stop-opacity="0"/>

<stop offset="1"
stop-color="black"
stop-opacity="0.95"/>

</linearGradient>


</defs>



<rect
width="1080"
height="220"
fill="url(#top)"
/>


<rect
y="700"
width="1080"
height="380"
fill="url(#bottom)"
/>




<text
x="540"
y="75"
fill="#FFD400"
font-size="28"
font-family="Arial"
font-weight="700"
letter-spacing="9"
text-anchor="middle">

GARAGE88JAKARTA

</text>




<text
x="70"
y="815"
fill="#FFD400"
font-size="25"
font-family="Arial"
font-weight="700"
letter-spacing="6">

${escapeXml(
brand.toUpperCase()
)}

</text>




<text
x="70"
y="880"
fill="white"
font-size="${getFontSize(title)}"
font-family="Arial Black, Arial"
font-weight="900">

${title}

</text>




<text
x="70"
y="915"
fill="#FFD400"
font-size="30"
font-family="Arial">

AT ${year}

</text>




<rect
x="70"
y="935"
width="900"
height="3"
fill="#FFD400"
/>





<text
x="970"
y="985"
fill="white"
font-size="17"
font-family="Arial"
letter-spacing="4"
text-anchor="end">

OTR CREDIT

</text>





<text
x="970"
y="1045"
fill="#FFD400"
font-size="58"
font-family="Arial Black"
font-weight="900"
text-anchor="end">

${Math.round(price/1000000)} JT

</text>



</svg>

`;





const background =
await sharp(
  Buffer.from(imageBuffer)
)

.resize(
1080,
1080,
{
fit:"cover"
}
)

.blur(25)

.modulate({
brightness:0.55
})

.toBuffer();





const carPhoto =
await sharp(
  Buffer.from(imageBuffer)
)

.resize(
1080,
810,
{
fit:"cover"
}
)

.toBuffer();






return await sharp(background)

.composite([

{
input:carPhoto,
top:135,
left:0
},

{
input:Buffer.from(svg),
top:0,
left:0
}

])

.jpeg({
quality:92
})

.toBuffer();


}