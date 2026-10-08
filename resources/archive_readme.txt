README

This data file is published by the Movebank Data Repository (www.datarepository.movebank.org). As of the time of publication, a version of this published animal tracking dataset can be viewed on Movebank (www.movebank.org) in the study "Vultures Acopian Center USA GPS" (Movebank Study ID 481458). Individual attributes in the data files are defined below, in the NERC Vocabulary Server at http://vocab.nerc.ac.uk/collection/MVB and in the Movebank Attribute Dictionary at www.movebank.org/cms/movebank-content/movebank-attribute-dictionary. Metadata describing this data package are maintained at https://datacite.org.

This published dataset contains data in the study "Vultures Acopian Center USA GPS" through 29 December 2021. The study is ongoing and newer data are publicly available from the Movebank study.

This data package includes the following data files:
Vultures Acopian Center USA GPS_2003-2021-gps.csv
Vultures Acopian Center USA GPS_2003-2021-accessory.csv
Vultures Acopian Center USA GPS_2003-2021-reference-data.csv

Portions of this dataset were previously published as DOIs 10.5441/001/1.37r2b884 and 10.5441/001/1.46ft1k05.

Data package citation:
Bildstein KL, Barber D, Bechard MJ, Graña Grilli M, Therrien J. 2021. Data from: Study "Vultures Acopian Center USA GPS" (2003-2021). Movebank Data Repository. https://doi.org/10.5441/001/1.f3qt46r2

These data are described in the following written publications:
Mallon JM, Bildstein KL, Fagan WF. 2021. Inclement weather forces stopovers and prevents migratory progress for obligate soaring migrants. Mov Ecol. 9:39. https://doi.org/10.1186/s40462-021-00274-6

Graña Grilli M, Lambertucci SA, Therrien J-F, Bildstein KL. 2017. Wing size but not wing shape is related to migratory behavior in a soaring bird. J Avian Biol. 48(5):669-678. https://doi.org/10.1111/jav.01220

Dodge S, Bohrer G, Bildstein K, Davidson SC, Weinzierl R, Mechard MJ, Barber D, Kays R, Brandes D, Han J, et al. 2014. Environmental drivers of variability in the movement ecology of turkey vultures (Cathartes aura) in North and South America. Philos T Roy Soc B. 369(1643):20130195. https://doi.org/10.1098/rstb.2013.0195

-----------

Terms of Use
This data file is licensed by the Creative Commons Zero (CC0 1.0) license. The intent of this license is to facilitate the re-use of works. The Creative Commons Zero license is a "no rights reserved" license that allows copyright holders to opt out of copyright protections automatically extended by copyright and other laws, thus placing works in the public domain with as little legal restriction as possible. However, works published with this license must still be appropriately cited following professional and ethical standards for academic citation.

We highly recommend that you contact the data creator if possible if you will be re-using or re-analyzing data in this file. Researchers will likely be interested in learning about new uses of their data, might also have important insights about how to properly analyze and interpret their data, and/or might have additional data they would be willing to contribute to your project. Feel free to contact us at support@movebank.org if you need assistance contacting data owners.

For additional information, see

License description: http://creativecommons.org/publicdomain/zero/1.0

General Movebank Terms of Use: www.movebank.org/cms/movebank-content/general-movebank-terms-of-use

Movebank user agreement: https://www.movebank.org/cms/movebank-content/data-policy#user_agreement

-----------

Data Attributes
These definitions come from the Movebank Attribute Dictionary, available at http://vocab.nerc.ac.uk/collection/MVB and www.movebank.org/node/2381.

algorithm marked outlier: Identifies events marked as outliers using a user-selected filter algorithm in Movebank. Outliers have the value TRUE.
units: none
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000011
THIS DATASET: The value range and duplicate filters in Movebank were run in December 2021 with the following settings: (1) Speed Filter settings are max. plausible speed = 30.2778 m/s; max. location error = 100 m; 'longest consistent track' algorithm. (2) Duplicate Filter settings are Key Attributes = Tag ID, Timestamp; prefer values when Location Lat is_not_null.

animal comments: Additional information about the animal that is not described by other reference data terms.
example: sibling of #1423
units: none
entity described: individual
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000012

animal death comments: Comments about the death of the animal.
example: hit by a car
units: none
entity described: individual
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000013

animal ID: An individual identifier for the animal, provided by the data owner. If the data owner does not provide an Animal ID, an internal Movebank animal identifier is sometimes shown.
example: 91876A, Gary
units: none
entity described: individual
same as: individual local identifier
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000016

animal latest date born: The latest date an animal is thought to have been born.
example: 2001-12-12 00:00:00.000'
format: yyyy-MM-dd HH:mm:ss.SSS
units: UTC (sometimes date is provided based on local time)
entity described: individual
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000017

animal life stage: The age class or life stage of the animal at the beginning of the deployment. Can be years or months of age or terms such as 'adult', 'subadult' and 'juvenile'. Best practice is to define units in the values if needed (e.g. '2 years').
example: juvenile, adult
units: not defined
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000018

animal mass: The mass of the animal, typically at the beginning of the deployment.
example: 500
units: grams
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000019

animal ring ID: A number or color scheme for a band or ring attached to the animal.
example: 26225
units: none
entity described: individual
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000022

animal sex: The sex of the animal. Allowed values are
m = male
f = female
u = unknown
format: controlled list
entity described: individual
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000023

animal taxon: The scientific name of the species on which the tag was deployed, as defined by the Integrated Taxonomic Information System (ITIS, www.itis.gov). If the species name can not be provided, this should be the lowest level taxonomic rank that can be determined and that is used in the ITIS taxonomy. Additional information can be provided using the term 'taxon detail'
format: controlled list
entity described: individual
same as: individual taxon canonical name
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000024

animal taxon detail: A more specific name and/or reference for the taxon name provided by 'animal taxon'. This can be used, for example, to specify a subspecies or a taxon not supported by the ITIS.
example: Calonectris diomedea borealis (Cory, 1881)
units: none
entity described: individual
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000025

attachment type: The way a tag is attached to an animal. Values are chosen from a controlled list:
collar = The tag is attached by a collar around the animal's neck
fin mount = The tag is attached to the animal's fin
glue = The tag is attached to the animal using glue
harness = The tag is attached to the animal using a harness
implant = The tag is placed under the skin of the animal
tape = The tag is attached to the animal using tape
other = user specified
format: controlled list
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000052

deploy off person: The name of the person/people who removed the tag from the animal and ended the deployment.
example: J. Smith
units: none
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000076

deploy off timestamp: The timestamp when the tag deployment ended, as defined by the data owner.
example: 2009-10-01 12:00:00.000'
format: yyyy-MM-dd HH:mm:ss.SSS
units: UTC or GPS time
entity described: deployment
same as: deploy off date
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000077

deploy on person: The name of the person/people who attached the tag to the animal and began the deployment.
example: G. Smith
units: none
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000080

deploy on timestamp: The timestamp when the tag deployment started.
example: 2008-08-30 18:00:00.000'
format: yyyy-MM-dd HH:mm:ss.SSS
units: UTC or GPS time
entity described: deployment
same as: deploy on date
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000081

deployment comments: Additional information about the tag deployment that is not described by other reference data terms.
example: body length 154 cm; condition good
units: none
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000082

deployment end comments: A description of the end of a tag deployment, such as cause of mortality or notes on the removal and/or failure of tag.
example: data transmission stopped after 108 days. Cause unknown
units: none
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000083

deployment end type: A categorical classification of the tag deployment end, from a controlled list:
captured = The tag remained on the animal but the animal was captured or confined
dead = The deployment ended with the death of the animal that was carrying the tag
equipment failure = The tag stopped working
fall off = The attachment of the tag to the animal failed, and it fell of accidentally
other = other
released = The tag remained on the animal but the animal was released from captivity or confinement
removal = The tag was purposefully removed from the animal
unknown = The deployment ended by an unknown cause
format: controlled list
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000084

deployment ID: A unique identifier for the deployment of a tag on animal, provided by the data owner. If the data owner does not provide a Deployment ID, an internal Movebank deployment identifier may sometimes be shown.
example: Jane-Tag42
units: none
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000085

duty cycle: Remarks associated with the duty cycle of a tag during the deployment, describing the times it is on/off and the frequency at which it transmits or records data. Units and time zones should be defined in the remarks.
example: 15-min fixes from 8:00-18:00 local time (0:00-10:00 UTC)
units: not defined
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000086

external temperature: The temperature measured by the tag (different from ambient temperature or internal body temperature of the animal).
example: 32.1
units: degrees Celsius
entity described: event
same as: temperature external
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000104

event ID: An identifier for the set of values associated with each event, i.e. sensor measurement. A unique event ID is assigned to every time-location or other time-measurement record in Movebank. If multiple measurements are included within a single row of a data file, they will share an event ID. If users import the same sensor measurement to Movebank multiple times, a separate event ID will be assigned to each.
example: 6340565
units: none
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000103

GPS HDOP: Horizontal dilution of precision provided by the GPS.
example: 1.2
units: unitless
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000118

GPS satellite count: The number of GPS satellites used to estimate the location.
example: 8
units: none
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000120

GPS time to fix: The time required to obtain the GPS location fix.
example: 36
units: s
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000121

GPS VDOP: Vertical dilution of precision provided by the GPS.
example: 1.9
units: unitless
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000122

ground speed: The estimated ground speed provided by the sensor or calculated between consecutive locations.
example: 7.22
units: m/s
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000124

Gt activity count: A value provided by GeoTrak tags that can be used to generally indicate whether an animal is active.
example: 209
units: none
entity described: event
link: no link (deprecated attribute, duplicate of 'GPS activity count')

Gt sys week: The week number since the device was activated (definition from GeoTrak's 'PTT Decode Overview', 2014).
example: 4
units: weeks
entity described: event
same as: GeoTrak sys week
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000111

Gt tx count: The number of transmissions since last rollover (definition from GeoTrak's 'PTT Decode Overview', 2014).
example: 4840
units: none
entity described: event
same as: GeoTrak Tx Count
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000112

heading: The direction in which the tag is moving, in decimal degrees clockwise from north, as provided by the sensor or calculated between consecutive locations. Values range from 0-360: 0 = north, 90 = east, 180 = south, 270 = west.
example: 315.88
units: degrees clockwise from north
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000129

height above ellipsoid: The estimated height above the ellipsoid, typically estimated by the tag. If altitudes are calculated as height above mean sea level, use 'height above mean sea level'.
example: 24.8
units: meters
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000130

height raw: Raw values for the height of the tag above ellipsoid or mean sea level, typically estimated by the tag. Values are stored as raw text values because non-numeric characters are used or processing is required to derive the correct height estimate. Best practice is to define values in the reference data.
example: 425, 2D fix
units: not defined
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000132

import marked outlier: Identifies events as outliers. Typically used to import a record of outliers that were identified by the data provider or owner with automated methods outside of Movebank. Outliers have the value TRUE.
units: none
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000133

location error numerical: An estimate of the horizontal error of the location including only numbers. (If the error estimates include non-numerical characters such as '>' use 'location error text'.) These values can be described using 'location error percentile' and 'location accuracy comments'.
example: 50
units: m
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000142

location lat: The geographic latitude of the location as estimated by the sensor. Positive values are east of the Greenwich Meridian, negative values are west of it.
example: -41.0982423
units: decimal degrees, WGS84 reference system
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000145

location long: The geographic longitude of the location as estimated by the sensor. Positive values are east of the Greenwich Meridian, negative values are west of it.
example: -121.1761111
units: decimal degrees, WGS84 reference system
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000146

manipulation type: The way in which the animal was manipulated during the deployment. Additional information can be provided using 'manipulation comments'. Values are chosen from a controlled list:
confined = The animal's movement was restricted to within a defined area
none = The animal received no treatment other than the tag attachment
relocated = The animal was released from a site other than the one at which it was captured
manipulated other = The animal was manipulated in some other way, such as a physiological manipulation
format: controlled list
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000155

manually marked outlier: Identifies events flagged manually as outliers, typically using the Event Editor in Movebank, and may also include outliers identified using other methods. Outliers have the value TRUE.
units: none
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000156

Mw activity count: The activity counter value. This value increments when the PTT is moving while it is transmitting. If the activity counter is constant for two or more transmission periods (and the GPS locations are unvarying), you should consider the possibility that the PTT has become detached or the bird is down (definition from the Microwave Telemetry, Inc. Solar Argos/GPS PTT-100 Field Manual, 2012).
example: 209
units: none
entity described: event
same as: Microwave activity count
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000158

Mw show in KML: Used by Microwave GPS tags to flag implausible locations. Allowed values are
TRUE or FALSE; implausible locations have the value FALSE.
units: none
entity described: event
same as: Microwave show in KML
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000159

raptor workshop migration state: Migration states used for analysis as part of the Movebank raptor workshop in Hawk Mountain, USA, February 2009. Values are chosen from a controlled list: 
breeding grounds = in the breeding grounds; fall migration = on fall migration
migration = on a seasonal migration
natal area = in the area where the animal was born
non-breeding grounds = in the non-breeding grounds, i.e. wintering grounds
spring migration = on spring migration
stopover = in a stopover site during a migration
summer non-breeding = in a summer non-breeding grounds
format: controlled list
entity described: event
link: no link (deprecated attribute)

sensor type: The type of sensor with which data were collected. All sensors are associated with a tag id, and tags can contain multiple sensor types. Each event record in Movebank is assigned one sensor type. If values from multiple sensors are reported in a single event, the primary sensor is used. Values are chosen from a controlled list:
acceleration = The sensor collects acceleration data
accessory measurements = The sensor collects accessory measurements, such as battery voltage
acoustic telemetry = The sensor transmits an acoustic signal that is detected by receivers to determine location
Argos Doppler shift = The sensor uses Argos Doppler shift to determine location
barometer = The sensor records air or water pressure
bird ring = The animal is identified by a band or ring that has a unique identifier
GPS = The sensor uses GPS to determine location
magnetometer = The sensor records the magnetic field
natural mark = The animal is identified by a unique natural marking
orientation = Quaternion components describing the orientation of the tag are derived from accelerometer and gyroscope measurements
radio transmitter = The sensor transmits a radio signal that is detected by receivers to determine location
solar geolocator = The sensor collects light levels, which are used to determine position (for processed locations)
solar geolocator raw = The sensor collects light levels, which are used to determine position (for raw light-level measurements)
solar geolocator twilight = The sensor collects light levels, which are used to determine position (for twilights calculated from light-level measurements)
format: controlled list
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000170

study name: The name of the study in Movebank.
example: Coyotes, Kays and Bogan, Albany NY
units: none
entity described: study (event)
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000173

study site: A location such as the deployment site or colony, or a location-related group such as the herd or pack name.
example: Pickerel Island North
units: none
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000175

tag battery voltage: The voltage as reported by the tag.
example: 2895
units: mV
entity described: event
link: no link (deprecated attribute, duplicate of 'tag voltage')

tag ID: A unique identifier for the tag, provided by the data owner. If the data owner does not provide a tag ID, an internal Movebank tag identifier may sometimes be shown.
example: 2342
units: none
entity described: tag
same as: tag local identifier
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000181

tag manufacturer name: The company or person that produced the tag.
example: Holohil
units: none
entity described: tag
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000183

tag mass: The mass of the tag.
example: 24
units: grams
entity described: tag
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000184

tag model: The model of the tag.
example: T61
units: none
entity described: tag
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000185

tag processing type: Used to distinguish between data formats produced by different types of Microwave tags (currently not used). units: none
entity described: tag
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000186/

tag production date: The approximate date the tag was produced (can be a year, month, or day).
example: March 2011
units: not defined
entity described: tag
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000187

tag readout method: The way the data are received from the tag. Values are chosen from a controlled list:
satellite = Data are transferred via satellite
phone network = Data are transferred via a phone network, such as GSM or AMPS
other wireless = Data are transferred via another form of wireless data transfer, such as a VHF transmitter/receiver
tag retrieval = The tag must be physically retrieved in order to obtain the data
format: controlled list
entity described: deployment
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000188

tag serial no: The serial number of the tag.
example: MN93-33243
units: none
entity described: tag
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000189

tag voltage: The voltage as reported by the tag.
example: 2895
units: mV
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000191

timestamp: The date and time corresponding to a sensor measurement or an estimate derived from sensor measurements.
example: 2008-08-14 18:31:00.000'
format: yyyy-MM-dd HH:mm:ss.SSS
units: UTC or GPS time
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000200

vertical error numerical: An estimate of the vertical error of the location. These values can be described using 'location error percentile' and 'location accuracy comments'.
example: 12
units: m
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000208

visible: Determines whether an event is visible on the Movebank map. Values are calculated automatically, with TRUE indicating the event has not been flagged as an outlier by 'algorithm marked outlier', 'import marked outlier' or 'manually marked outlier', or that the user has overridden the results of these outlier attributes using 'manually marked valid' = TRUE. Allowed values are TRUE or FALSE.
units: none
entity described: event
link: http://vocab.nerc.ac.uk/collection/MVB/current/MVB000209

-----------

More Information
For more information about this repository, see www.movebank.org/cms/movebank-content/data-repository, the FAQ at https://www.datarepository.movebank.org/faq, or contact us at support@movebank.org.