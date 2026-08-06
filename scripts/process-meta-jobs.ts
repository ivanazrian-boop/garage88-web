import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createMetaCover } from "../src/lib/metacover";


const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);



const WAIT_TIME = 10000;



async function sleep(ms:number){

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );

}




async function processJobs(){


console.log(
"CHECK JOBS..."
);



const {
  data:jobs,
  error
}
=
await supabase

.from("meta_cover_jobs")

.select("*")

.eq(
"status",
"pending"
)

.order(
"created_at",
{
ascending:true
}
)

.limit(5);




if(error){

console.error(
"JOB FETCH ERROR:",
error
);

return;

}





if(!jobs || jobs.length===0){

console.log(
"NO JOB"
);

return;

}




console.log(
"FOUND JOB:",
jobs.length
);





for(const job of jobs){


try{


console.log(
"PROCESS:",
job.car_id
);




// lock job supaya tidak double

await supabase

.from("meta_cover_jobs")

.update({

status:"processing"

})

.eq(
"id",
job.id
);






const {
data:car,
error:carError
}
=
await supabase

.from("cars")

.select(`

id,
brand,
model,
variant,
year,
credit_price,

car_images(
image_url,
sort_order
)

`)

.eq(
"id",
job.car_id
)

.single();






if(carError){

throw carError;

}





const images =
car.car_images
?.sort(
(a:any,b:any)=>
a.sort_order-b.sort_order
)
?? [];





if(images.length===0){

throw new Error(
"No image"
);

}






const title =
[
car.model,
car.variant
]
.filter(Boolean)
.join(" ");







console.log(
"CREATE COVER:",
title
);






const buffer =
await createMetaCover(

images[0].image_url,

car.brand,

title,

car.year,

car.credit_price

);







const fileName =
`${car.id}.jpg`;







const {
error:uploadError
}
=
await supabase.storage

.from("meta_covers")

.upload(

fileName,

buffer,

{

contentType:"image/jpeg",

upsert:true

}

);






if(uploadError){

throw uploadError;

}







const {
data:url
}
=
supabase.storage

.from("meta_covers")

.getPublicUrl(
fileName
);







await supabase

.from("cars")

.update({

meta_image_url:
url.publicUrl

})

.eq(
"id",
car.id
);







await supabase

.from("meta_cover_jobs")

.update({

status:"done",

processed_at:
new Date()

})

.eq(
"id",
job.id
);







console.log(
"DONE:",
car.brand,
title
);





}
catch(err){


console.error(
"FAILED:",
job.car_id,
err
);





await supabase

.from("meta_cover_jobs")

.update({

status:"error",

error_message:
String(err)

})

.eq(
"id",
job.id
);



}



}



}








async function watcher(){


console.log(
"META COVER WATCHER START"
);



while(true){


try{


await processJobs();


}
catch(err){


console.error(
"WATCHER ERROR:",
err
);


}




console.log(
`WAIT ${WAIT_TIME / 1000}s`
);



await sleep(
WAIT_TIME
);



}


}





watcher();