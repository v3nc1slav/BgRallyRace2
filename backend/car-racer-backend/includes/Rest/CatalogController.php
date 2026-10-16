<?php

namespace BgRally\Rest;

use BgRally\Catalog\Cities;

final class CatalogController
{
    public static function cities()
    {
        return Cities::active();
    }
}
