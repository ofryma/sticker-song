# Todo

## Observability

* Uptime check against `/healthz` with alerting — it exists and nothing calls it (ofry's comment - lets add uptime kuma)

## Improvments
* When the user is creating a new sticker, it first enters the name of the person. in this part we can initiate a search that 
will check if there is already existing sticker in the database. that way we prevent the uploading of the duplicate. This change should come with a way to give the user a chance to use the existing sticker and drop the uploading of the new one, start a new uploading session or say that his image is better and they still want to upload to improve the existing record.