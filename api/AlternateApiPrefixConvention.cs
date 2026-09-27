using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace AgamiPatha.Api;

/// <summary>
/// IIS application at /api strips the prefix, so /api/stats arrives as /stats.
/// Keep the existing api/... routes for local proxy and also accept the stripped paths.
/// </summary>
public sealed class AlternateApiPrefixConvention : IApplicationModelConvention
{
    public void Apply(ApplicationModel application)
    {
        foreach (var controller in application.Controllers)
        {
            var extra = new List<SelectorModel>();
            foreach (var selector in controller.Selectors)
            {
                var template = selector.AttributeRouteModel?.Template;
                if (string.IsNullOrEmpty(template))
                {
                    continue;
                }

                if (template.Equals("api", StringComparison.OrdinalIgnoreCase))
                {
                    extra.Add(CloneWithTemplate(selector, string.Empty));
                }
                else if (template.StartsWith("api/", StringComparison.OrdinalIgnoreCase))
                {
                    extra.Add(CloneWithTemplate(selector, template[4..]));
                }
            }

            foreach (var selector in extra)
            {
                controller.Selectors.Add(selector);
            }
        }
    }

    private static SelectorModel CloneWithTemplate(SelectorModel source, string template)
    {
        return new SelectorModel(source)
        {
            AttributeRouteModel = new AttributeRouteModel(source.AttributeRouteModel!)
            {
                Template = template
            }
        };
    }
}
