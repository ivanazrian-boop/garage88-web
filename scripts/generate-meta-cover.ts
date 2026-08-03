import sharp from "sharp";


async function generate(){


const imageUrl =
"https://otlydqitiwgtnrqvpjyf.supabase.co/storage/v1/object/public/cars/01c91e24-95dd-4f5a-a1a6-f930ce0de883/602e8e0b-e209-48c5-854b-7c6131600da4.jpg";


const price =
"230 JT";



const imageBuffer =
await fetch(imageUrl)
.then(res=>res.arrayBuffer());






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





<!-- TOP -->

<rect
width="1080"
height="220"
fill="url(#top)"
/>





<!-- BOTTOM -->

<rect
y="700"
width="1080"
height="380"
fill="url(#bottom)"
/>







<!-- GARAGE -->

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







<!-- BRAND -->

<text
x="70"
y="815"
fill="#FFD400"
font-size="25"
font-family="Arial"
font-weight="700"
letter-spacing="6">

HYUNDAI

</text>







<!-- MODEL -->

<text
x="70"
y="880"
fill="white"
font-size="40"
font-family="Arial Black, Arial"
font-weight="900"
letter-spacing="1">

KIJANG INNOVA ZENIX Q HYBRID TSS

</text>







<!-- YEAR -->

<text
x="180"
y="915"
fill="#FFD400"
font-size="30"
font-family="Arial"
font-weight="700"
text-anchor="end">

AT 2023

</text>








<!-- LINE -->

<rect
x="70"
y="935"
width="900"
height="3"
fill="#FFD400"

/>







<!-- OTR -->

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








<!-- PRICE -->

<text
x="970"
y="1045"
fill="#FFD400"
font-size="58"
font-family="Arial Black"
font-weight="900"
text-anchor="end">

${price}

</text>





</svg>

`;








// BACKGROUND BLUR

const background =
await sharp(Buffer.from(imageBuffer))

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







// FOTO UTAMA

const carPhoto =
await sharp(Buffer.from(imageBuffer))

.resize(
1080,
810,
{
fit:"cover"
}
)

.toBuffer();








// FINAL

await sharp(background)

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


.toFile("./meta-test.jpg");



console.log("DONE");


}



generate();