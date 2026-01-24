/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
*/

import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Tooltip } from "@webpack/common";

interface Gif {
    format: number;
    src: string;
    width: number;
    height: number;
    order: number;
    url: string;
}

interface PickerInstance {
    state: { resultType?: string; };
    props: {
        favorites: Gif[];
        favCopy?: Gif[];
    };
    handleSelectGIF: (gif: Gif) => void;
}

export default definePlugin({
    name: "GifShuffleFavorites",
    description: "Adds a shuffle button that sends a random gif from your favorites",
    authors: [Devs.amaanq],
    tags: ["Media", "Customisation"],

    patches: [
        {
            find: "renderHeaderContent()",
            replacement: {
                match: /(renderHeaderContent\(\).{1,200}FAVORITES:return)(.{1,200});(case)/,
                replace: "$1 $self.wrapFavoritesHeader($2, this);$3"
            }
        }
    ],

    wrapFavoritesHeader(original: any, instance: PickerInstance) {
        return (
            <ErrorBoundary noop>
                <FavoritesHeader original={original} instance={instance} />
            </ErrorBoundary>
        );
    }
});

function FavoritesHeader({ original, instance }: { original: any; instance: PickerInstance; }) {
    if (instance?.state?.resultType !== "Favorites") return original;

    const onShuffle = () => {
        const pool = instance.props.favCopy ?? instance.props.favorites;
        if (!pool?.length) return;
        const picked = pool[Math.floor(Math.random() * pool.length)];
        instance.handleSelectGIF(picked);
    };

    return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1, minWidth: 0 }}>{original}</div>
            <Tooltip text="Send a random favorite">
                {tooltipProps => (
                    <div
                        {...tooltipProps}
                        role="button"
                        tabIndex={0}
                        aria-label="Send a random favorite gif"
                        onClick={onShuffle}
                        onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onShuffle();
                            }
                        }}
                        style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "32px",
                            height: "32px",
                            borderRadius: "4px",
                            color: "var(--interactive-normal)",
                            flexShrink: 0
                        }}
                    >
                        <ShuffleIcon />
                    </div>
                )}
            </Tooltip>
        </div>
    );
}

function ShuffleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="currentColor"
                d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
            />
        </svg>
    );
}
