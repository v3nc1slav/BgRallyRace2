<?php

namespace BgRally\Database;

final class Tables
{
    public static function name(string $table): string
    {
        global $wpdb;
        return $wpdb->prefix . 'bgr_' . $table;
    }
}
