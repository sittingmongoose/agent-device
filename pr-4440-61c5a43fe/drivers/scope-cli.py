import json, pathlib, shutil, subprocess, sys, time
command, config, udid, mode, output = sys.argv[1:]
root=pathlib.Path(output); root.mkdir(parents=True,exist_ok=True)
base=[command,'--config',config,'--platform','ios','--udid',udid,'--ios-simulator-device-set','<MAC_HOME>/.simlock/devices/ios']
def step(name,args,expected=0):
    before=time.time()
    r=subprocess.run(base+args+['--json','--debug'],capture_output=True,text=True,timeout=180)
    (root/(name+'.stdout')).write_text(r.stdout); (root/(name+'.stderr')).write_text(r.stderr)
    (root/(name+'.meta.json')).write_text(json.dumps({'args':args,'exitCode':r.returncode,'startedAt':before,'finishedAt':time.time()}))
    print(name,r.returncode,round(time.time()-before,3),flush=True)
    if expected is not None and r.returncode!=expected: raise RuntimeError(name+': '+r.stdout+' '+r.stderr)
    return r
def shot(name):
    dest=pathlib.Path('/tmp')/('pr4440-r2-'+mode+'-'+name+'.png')
    step(name+'-shot',['screenshot',str(dest)])
    if dest.exists():
        shutil.copy2(dest,root/(name+'.png'))
        dest.unlink()
    else:
        (root/(name+'.remote-path')).write_text(str(dest))
step('S00-open',['open','com.apple.mobilesafari'])
step('S01-close-pose',['fold','closed'],None)
for n,t in [('S02','landscape-left'),('S04','landscape-right'),('S05','portrait')]:
    step(n+'-outer-'+t,['orientation',t])
    if mode=='final':
        shot(n)
    if n=='S02' and mode=='final': step('S03-repeat',['orientation',t])
step('S06-open-pose',['fold','open'],None)
for n,t in [('S07','portrait'),('S08','landscape-left'),('S09','landscape-right')]:
    step(n+'-inner-'+t,['orientation',t])
    if mode=='final': shot(n)
if mode=='final':
    step('S10-close-pose',['fold','closed'],None)
    step('S11-post-fold',['orientation','landscape-left'])
    shot('S11')
    step('S12-settings',['open','com.apple.Preferences'])
    failed=step('S13-unachievable',['orientation','landscape-right'],1)
    assert json.loads(failed.stdout)['error']['details']['reason']=='orientation-unverified'
    shot('S13')
step('S99-close',['close'],None)
