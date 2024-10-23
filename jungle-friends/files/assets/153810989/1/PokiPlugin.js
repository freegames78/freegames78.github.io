var PokiPlugin = {
    adblock : false,
    isPaused : false,
    canShowAds : false,
    isGamePaused : true,
    isAlreadyLoaded : false,
    gameplayStartFail : false,
    midrollInterval : 60 * 2,
    totalGameplay : 0,
    init : function(){
        var isMobile = Utils.getURLParam('isMobile');
    
        if(isMobile){
            console.log('It works in mobile application wrapper, PokiSDK wont be working');
            
            return false;
        }

        var style = document.createElement('style');
        style.innerHTML = '#application-console{ display:none; }'
        document.head.appendChild(style);
        
        var script = document.createElement('script');
        script.src = './poki-sdk.js';
        script.onload = function(){
            PokiPlugin.onLoad();
        };

        document.head.append(script);
    },
    onLoad : function(){
        PokiSDK.init({ volume: 0.35 }).then(function(){
            console.log('PokiSDK Loaded!');
            PokiPlugin.loadCompleted();
            PokiPlugin.canShowAds = true;
        }).catch(function(){
            PokiPlugin.adblock = true;
            PokiPlugin.loadCompleted();
            console.log('Initialized, but the user likely has adblock');
        });

        /*
        setInterval(function(){
            PokiPlugin.tick();
        }, 1000);
        */
    },
    tick : function(dt){
        if(!this.isGamePaused){
            this.totalGameplay+=dt;
        }
    },
    loadCompleted : function(){
        if(this.isAlreadyLoaded){
            return false;
        }

        //requested to fire after load complete
        PokiSDK.gameLoadingFinished();

        //has been requested by Poki to trigger commercial before gameplay
        //PokiPlugin.showMidroll();
        //PokiPlugin.playGame();

        if(this.isAlreadyTriggered && this.gameplayStartFail){
            PokiSDK.gameplayStart();
        }

        this.isAlreadyLoaded = true;
    },
    onPause : function(){
        if(this.isGamePaused){
            return false;
        }

        if(typeof PokiSDK !== 'undefined'){
            PokiSDK.gameplayStop();
        }

        this.isGamePaused = true;
        console.log('[EVENT] Game paused!');
    },
    pauseGame : function(){
        if(typeof pc !== 'undefined'){
            pc.app.timeScale = 0;
            PokiPlugin.isPaused = true;

            if(pc.app.systems && pc.app.systems.sound){
                pc.app.systems.sound.volume = 0;
            }

            pc.app.fire('Player:Stop');
            pc.app.fire('Gameplay:Pause');
        }
        
        PokiPlugin.onPause();
    },
    onPlay : function(){
        if(!this.isGamePaused){
            return false;
        }

        if(typeof PokiSDK !== 'undefined'){
            PokiSDK.gameplayStart();
        }

        this.lastGameplayStart  = Date.now();
        this.isAlreadyTriggered = true;

        this.isGamePaused = false;

        console.log('[EVENT] Game play!');
    },
    firstGameplayEvent : function(){
        if(this.isAlreadyTriggered){
            return false;
        }

        this.onPlay();
        
        this.lastGameplayStart = Date.now();
        this.isAlreadyTriggered = true;
    },
    playGame : function(){
        if(typeof pc !== 'undefined'){
            pc.app.timeScale = 1;
            PokiPlugin.isPaused = false;

            if(pc.app.systems && pc.app.systems.sound){
                pc.app.systems.sound.volume = pc.app.systems.sound.originalVolume;
            }
            
            pc.app.fire('Gameplay:Play');
        }

        PokiPlugin.onPlay();
    },
    showMidroll : function(callback){
        if(typeof PokiSDK !== 'undefined'){
            PokiPlugin.pauseGame();

            PokiSDK.commercialBreak().
            then(function(success){
                if(callback){
                    callback(success);
                }

                PokiPlugin.playGame();
            });

            PokiPlugin.totalGameplay = 0;

            pc.app.fire('PokiSDK:CommercialBreak');
        }else{
            callback();
        }
    },
    checkMidrollCondition : function(){
        return PokiPlugin.totalGameplay >= PokiPlugin.midrollInterval;
    },
    isSatisfied : false,
    checkSatisfaction : function(){
        return this.isSatisfied && this.checkMidrollCondition();
    },
    showConditionedMidroll : function(callback){
        if(typeof PokiSDK !== 'undefined'){
            if(
                PokiPlugin.totalGameplay >= PokiPlugin.midrollInterval
            ){
                console.log('Condition midroll has been triggered!');
                
                PokiPlugin.showMidroll(function(){
                    if(callback){
                        callback();
                    }
                });
            }else{
                if(callback){
                    callback();
                }
            }
        }else{
            if(callback){
                callback();
            }
        }
    },
    showReward : function(callback, options){
        if(PokiPlugin.adblock){
            if(typeof pc !== 'undefined'){
                pc.app.fire('Overlay:Adblock');
            }
            
            return false;
        }

        if(!PokiPlugin.canShowAds){
            if(typeof pc !== 'undefined'){
                pc.app.fire('Overlay:Adblock');
            }
            return false;
        }

        if(options && options.disableEvents){
            //events disabled
            console.log('Events disabled');
        }else{
            PokiPlugin.pauseGame();
        }

        PokiSDK.rewardedBreak().
        then(function(success){
            if(success){
                callback(success);
            }
        
            if(options && options.disableEvents){
                console.log('Events disabled');
                //events disabled
            }else{
                PokiPlugin.playGame();
            }
        });

        //global event
        pc.app.fire('PokiSDK:RewardedBreak');

        PokiPlugin.totalGameplay = 0;
    }
};

PokiPlugin.init();

window.addEventListener('keydown', function(ev){
    if (['ArrowDown', 'ArrowUp', ' '].includes(ev.key)) {
        ev.preventDefault();
    }

    PokiPlugin.firstGameplayEvent();
});

window.addEventListener('wheel', function(ev){
    ev.preventDefault()
}, { passive: false });

//also trigger first gameplay on click
window.addEventListener('click', function(ev){
    PokiPlugin.firstGameplayEvent();
});

//disable context
window.addEventListener('contextmenu', function(ev){
    ev.preventDefault();
});