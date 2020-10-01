import { Body, Controller, Get, HttpException, Param, Patch, Post, Put, UseInterceptors } from "@nestjs/common";
import { ResourceDefinition } from "./definition";
import { definitions } from "./definitions";
import { PatchBodyParser } from "./patch";


function doesTheNameMatchDefinition(name: string, definition: ResourceDefinition) {
  return definition.names.plural == name;
}

function getVersion(version: string, definition: ResourceDefinition) {
  return definition.versions.find( def => def.name == version );
}

@Controller("apis")
export class StackController {

  store = new Map<string, Map<string, unknown>>();

  @Get()
  definitions() {
    return definitions;
  }

  @Get(":group/:version/:resource")
  list(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string
  ) {
    console.log(group, versionName, resourceName);
    const definition = definitions.find(def => doesTheNameMatchDefinition(resourceName, def));
    const key = `${definition.group}/${definition.names.plural}`;

    const objects = this.store.has(key) ? this.store.get(key) : new Map();

    console.log(objects);
    return Array.from(objects.values());
  }

  @Get(":group/:version/:resource/:name")
  get(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string,
  ) {
    console.log(group, versionName, resourceName);
    const definition = definitions.find(def => doesTheNameMatchDefinition(resourceName, def));
    const key = `${definition.group}/${definition.names.plural}`;

    if (! this.store.has(key) ) {
      this.store.set(key, new Map());
    }
    const objects = this.store.get(key);

    return objects.get(objectName);
  }

  @Post(":group/:version/:resource")
  add(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Body() object: unknown
  ) {
    console.log(group, versionName, resourceName);
    const definition = definitions.find(def => doesTheNameMatchDefinition(resourceName, def));
    const key = `${definition.group}/${definition.names.plural}`;

    if (! this.store.has(key) ) {
      this.store.set(key, new Map());
    }

    const objects = this.store.get(key);

    const objectName = object['metadata'].name;

    if ( objects.has(objectName) ) {
      throw new HttpException({message: 'object already exists.'}, 409);
    } 

    objects.set(objectName, object);

    return objects;
  }

  @Put(":group/:version/:resource/:name")
  replace(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string,
    @Body() object: unknown
  ) {
    console.log(group, versionName, resourceName);
    const definition = definitions.find(def => doesTheNameMatchDefinition(resourceName, def));
    const key = `${definition.group}/${definition.names.plural}`;

    if (! this.store.has(key) ) {
      this.store.set(key, new Map());
    }

    const objects = this.store.get(key);

    if ( objects.has(objectName) ) {
      throw new HttpException({}, 409);
    } 

    objects.set(objectName, object);

    return objects;
  }

  @UseInterceptors(PatchBodyParser())
  @Patch(":group/:version/:resource/:name")
  patch(
    @Param("group") group: string,
    @Param("version") versionName: string,
    @Param("resource") resourceName: string,
    @Param("name") objectName: string,
    @Body() object: unknown
  ) {
    console.log(group, versionName, resourceName);
    const definition = definitions.find(def => doesTheNameMatchDefinition(resourceName, def));
    const key = `${definition.group}/${definition.names.plural}`;

    if (! this.store.has(key) ) {
      this.store.set(key, new Map());
    }

    const objects = this.store.get(key);

    if ( objects.has(objectName) ) {
      throw new HttpException({}, 409);
    } 

    objects.set(objectName, object);
    
    return objects;
  }
}
  
