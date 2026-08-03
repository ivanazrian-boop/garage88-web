import "dotenv/config";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";



const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);



function escapeXml(text:string){

return text
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&apos;");

}




function getFontSize(title:string){

const length = title.length;


if(length <= 18){
 return 70;
}

if(length <= 28){
 return 55;
}

return 40;

}




async function generateCover(
imageUrl:string,
brand:string,
model:string,
year:number,
price:number,
filePath:string
){


const imageBuffer =
await fetch(imageUrl)
.then(res=>res.arrayBuffer());



const title =
escapeXml(model.toUpperCase());


const fontSize =
getFontSize(title);



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

${escapeXml(brand.toUpperCase())}

</text>






<text
x="70"
y="880"
fill="white"
font-size="${fontSize}"
font-family="Arial Black, Arial"
font-weight="900"
letter-spacing="1">

${title}

</text>







<text
x="70"
y="915"
fill="#FFD400"
font-size="30"
font-family="Arial"
font-weight="700">

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

${price/1000000} JT

</text>





</svg>

`;






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







const output =
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

.toBuffer();






await fs.promises.writeFile(
filePath,
output
);



return output;


}







async function main(){



console.log("START GENERATE META COVER");



const {
data:cars,
error
}=await supabase

.from("cars")

.select(`
id,
brand,
model,
variant,
year,
credit_price,
status,
car_images(
image_url,
sort_order
)
`)

.eq(
"status",
"READY"
);




if(error)
throw error;



console.log(
`FOUND ${cars.length} CARS`
);





for(const car of cars){


try{


const images =
car.car_images
?.sort(
(a:any,b:any)=>
a.sort_order-b.sort_order
);



if(!images || images.length===0){

console.log(
`SKIP ${car.id} NO IMAGE`
);

continue;

}




const imageUrl =
images[0].image_url;



const title =
[
car.model,
car.variant
]
.filter(Boolean)
.join(" ");




const fileName =
`${car.id}.jpg`;



const localPath =
`./${fileName}`;





const buffer =
await generateCover(

imageUrl,

car.brand,

title,

car.year,

car.credit_price,

localPath

);






await supabase
.storage
.from("meta_covers")
.upload(
fileName,
buffer,
{
contentType:"image/jpeg",
upsert:true
}
);






const {
data:urlData
}=supabase

.storage

.from("meta_covers")

.getPublicUrl(
fileName
);





await supabase

.from("cars")

.update({

meta_image_url:
urlData.publicUrl

})

.eq(
"id",
car.id
);





console.log(
"OK",
car.brand,
title
);





await fs.promises.unlink(
localPath
);



}
catch(err){

console.log(
"ERROR",
car.id,
err
);

}


}




console.log(
"DONE ALL"
);



}




main();