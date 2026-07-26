/**
 * Convention: authorization logic lives in Policy classes
 * (EventPolicy.canPublish(), OrganizationPolicy.canDelete()), never as
 * scattered if(role===...) checks. Concrete policies are written per-module
 * as those modules are built.
 */
export abstract class BasePolicy<TActor, TResource> {
  protected constructor() {}
}