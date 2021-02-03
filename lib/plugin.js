import Vue from 'vue'

const toBooleanOrOtherOrFallback = (value, fallback) => value === 'false' ? false : value === 'true' ? true : value || fallback

const parseQueryToggles = (queryObject = {}, { prefix, mode }) => {
  return Object.entries(queryObject)
    .filter(([key]) => key.startsWith(`${prefix}_`))
    .map(([key, value]) => [key.replace(`${prefix}_`, ''), value])
    .reduce((toggles, [key, value]) => ({
      ...toggles,
      [key]: toBooleanOrOtherOrFallback(value, true)
    }), {})
}

export default (ctx, inject) => {
  const { $config, route, app: { router } } = ctx
  const { toggles: _toggles, queryString: _queryString } = JSON.parse(`<%= JSON.stringify(options) %>`)
  const runtimeConfig = ($config && $config.featureToggle) || {}
  const queryString = typeof runtimeConfig.queryString !== 'undefined' ? runtimeConfig.queryString : _queryString
  let queryToggles = {}

  if (queryString && queryString.enabled) {
    if (router && route) {
      queryToggles = parseQueryToggles(route.query, { ...queryString })
      router.afterEach((to) => {
        featureToggle.toggles = {
          ..._toggles,
          ...(runtimeConfig.toggles || {}),
          ...parseQueryToggles(to.query, queryString)
        }
      })
    }
  }
  const toggles = {
    ..._toggles,
    ...(runtimeConfig.toggles || {}),
    ...queryToggles
  }
  Vue.component('feature-toggle', () => import('./feature-toggle.vue'))

  const featureToggle = {
    toggles,
    queryString,
    isQueryStringAllowed: (fn) => {
      featureToggle.isQueryStringAllowedFn = fn
    }
  }

  ctx.$featureToggle = featureToggle
  inject('featureToggle', featureToggle)
}
