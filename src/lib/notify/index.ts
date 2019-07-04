/**
 * @prettier
 */

import Handlebars from 'handlebars';
import _ from 'lodash';

import { notifyRequest } from './notify-request';
import { OptionsWithUrl } from 'request';
import { Config, Package, RemoteUser, Notify } from '@verdaccio/types';

type TemplateMetadata = Package & { publishedPackage: string };

export function handleNotify(metadata: Package, notifyEntry, remoteUser: RemoteUser, publishedPackage: string): Promise<any> | void {
  let regex;
  if (metadata.name && notifyEntry.packagePattern) {
    regex = new RegExp(notifyEntry.packagePattern, notifyEntry.packagePatternFlags || '');
    if (!regex.test(metadata.name)) {
      return;
    }
  }

  const template: HandlebarsTemplateDelegate = Handlebars.compile(notifyEntry.content);

  // don't override 'publisher' if package.json already has that
  let templateMetadata: TemplateMetadata;
  // @ts-ignore
  if (!metadata.publisher) {
    // @ts-ignore
    templateMetadata = { ...metadata, publishedPackage, publisher: remoteUser.name as string };
  }
  const content: string = template(metadata);

  const options: OptionsWithUrl = {
    body: content,
    url: '',
  };

  // provides fallback support, it's accept an Object {} and Array of {}
  if (notifyEntry.headers && _.isArray(notifyEntry.headers)) {
    const header = {};
    notifyEntry.headers.map(function(item): void {
      if (Object.is(item, item)) {
        for (const key in item) {
          if (item.hasOwnProperty(key)) {
            header[key] = item[key];
          }
        }
      }
    });
    options.headers = header;
  } else if (Object.is(notifyEntry.headers, notifyEntry.headers)) {
    options.headers = notifyEntry.headers;
  }

  options.method = notifyEntry.method;

  if (notifyEntry.endpoint) {
    options.url = notifyEntry.endpoint;
  }

  return notifyRequest(options, content);
}

export function sendNotification(metadata: Package, notify: Notification, remoteUser: RemoteUser, publishedPackage: string): Promise<any> {
  return handleNotify(metadata, notify, remoteUser, publishedPackage) as Promise<any>;
}

export function notify(metadata: Package, config: Config, remoteUser: RemoteUser, publishedPackage: string): Promise<any> | void {
  if (config.notify) {
    if (_.isArray(config.notify) === false) {
      return sendNotification(metadata, (config.notify as unknown) as Notification, remoteUser, publishedPackage);
    } else {
      // multiple notifications endpoints PR #108
      return Promise.all(
        _.map(config.notify, function(notification: Notification): void {
          sendNotification(metadata, notification, remoteUser, publishedPackage);
        })
      );
    }
  }

  return Promise.resolve();
}