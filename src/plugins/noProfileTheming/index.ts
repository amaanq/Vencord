/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

const settings = definePluginSettings({
    keepOwn: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Keep your own profile customizations",
        restartNeeded: true
    },
    profileThemes: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Hide profile themes (text and background colors)",
        restartNeeded: true
    },
    profileEffects: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Hide profile effects",
        restartNeeded: true
    },
    avatarDecorations: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Hide avatar decorations",
        restartNeeded: true
    },
    displayNameStyles: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Hide display name styles (gradients and fonts)",
        restartNeeded: true
    }
});

export default definePlugin({
    name: "NoProfileTheming",
    description: "Removes Nitro profile themes, effects, avatar decorations, and display name styles",
    authors: [Devs.amaanq, Devs.TheKodeToad],
    settings,

    patches: [
        {
            find: "hasThemeColors(){",
            replacement: {
                match: /get canUsePremiumProfileCustomization\(\)\{return /,
                replace: "$&!$self.shouldHide(this.userId)&&"
            },
            predicate: () => settings.store.profileThemes
        },
        {
            find: "this.profileEffect=null!=",
            replacement: {
                match: /this\.profileEffect=(null!=.+?\.profileEffect),this\.popoutAnimationParticleType/,
                replace: "this.profileEffect=$self.shouldHide(this.userId)?void 0:$1,this.popoutAnimationParticleType"
            },
            predicate: () => settings.store.profileEffects
        },
        {
            find: "isAvatarDecorationAnimating",
            group: true,
            replacement: [
                {
                    match: /=(\i)=>\{let\{user:/,
                    replace: "=$1=>{const _vc_uid=$1.user?.id;let{user:"
                },
                {
                    match: /avatarDecorationSrc:(\i),isAvatarDecorationAnimating/,
                    replace: "avatarDecorationSrc:$self.shouldHide(_vc_uid)?void 0:$1,isAvatarDecorationAnimating"
                }
            ],
            predicate: () => settings.store.avatarDecorations
        },
        {
            find: 'location:"useDisplayNameStyles"',
            replacement: {
                match: /(function \i\(\)\{)/,
                replace: "$1if($self.shouldHide(arguments[0]?.userId))return;"
            },
            predicate: () => settings.store.displayNameStyles
        }
    ],

    shouldHide(userId: string) {
        if (settings.store.keepOwn && userId === UserStore.getCurrentUser()?.id) return false;
        return true;
    }
});
