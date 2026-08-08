import "dotenv/config";
import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);


async function queueAll(){

console.log("QUEUE ALL META START");


const {
  data:cars,
  error
}
=
await supabase

.from("cars")

.select("id, brand, model, meta_image_url")

.is(
"meta_image_url",
null
);



if(error){

console.error(error);
return;

}



console.log(
`FOUND ${cars?.length ?? 0} CARS`
);



if(!cars || cars.length===0){

console.log("NO CAR TO QUEUE");
return;

}



for(const car of cars){


const {
data:existing
}
=
await supabase

.from("meta_cover_jobs")

.select("id")

.eq(
"car_id",
car.id
)

.eq(
"status",
"pending"
)

.maybeSingle();



if(existing){

console.log(
"SKIP QUEUED:",
car.brand,
car.model
);

continue;

}



await supabase

.from("meta_cover_jobs")

.insert({

car_id:car.id,

status:"pending"

});


console.log(
"QUEUED:",
car.brand,
car.model
);


}



console.log(
"DONE QUEUE ALL"
);


}



queueAll();