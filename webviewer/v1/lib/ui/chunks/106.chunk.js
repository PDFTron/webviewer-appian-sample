(window.webpackJsonp=window.webpackJsonp||[]).push([[106],{1071:function(_,t,n){_.exports=function(_){"use strict";_=_&&_.hasOwnProperty("default")?_.default:_;var t="января_февраля_марта_апреля_мая_июня_июля_августа_сентября_октября_ноября_декабря".split("_"),n="январь_февраль_март_апрель_май_июнь_июль_август_сентябрь_октябрь_ноябрь_декабрь".split("_"),s="янв._февр._мар._апр._мая_июня_июля_авг._сент._окт._нояб._дек.".split("_"),e="янв._февр._март_апр._май_июнь_июль_авг._сент._окт._нояб._дек.".split("_"),r=/D[oD]?(\[[^[\]]*\]|\s)+MMMM?/;function o(_,t,n){var s,e;return"m"===n?t?"минута":"минуту":_+" "+(s=+_,e={mm:t?"минута_минуты_минут":"минуту_минуты_минут",hh:"час_часа_часов",dd:"день_дня_дней",MM:"месяц_месяца_месяцев",yy:"год_года_лет"}[n].split("_"),s%10==1&&s%100!=11?e[0]:s%10>=2&&s%10<=4&&(s%100<10||s%100>=20)?e[1]:e[2])}var M=function(_,s){return r.test(s)?t[_.month()]:n[_.month()]};M.s=n,M.f=t;var m=function(_,t){return r.test(t)?s[_.month()]:e[_.month()]};m.s=e,m.f=s;var i={name:"ru",weekdays:"воскресенье_понедельник_вторник_среда_четверг_пятница_суббота".split("_"),weekdaysShort:"вск_пнд_втр_срд_чтв_птн_сбт".split("_"),weekdaysMin:"вс_пн_вт_ср_чт_пт_сб".split("_"),months:M,monthsShort:m,weekStart:1,formats:{LT:"H:mm",LTS:"H:mm:ss",L:"DD.MM.YYYY",LL:"D MMMM YYYY г.",LLL:"D MMMM YYYY г., H:mm",LLLL:"dddd, D MMMM YYYY г., H:mm"},relativeTime:{future:"через %s",past:"%s назад",s:"несколько секунд",m:o,mm:o,h:"час",hh:o,d:"день",dd:o,M:"месяц",MM:o,y:"год",yy:o},ordinal:function(_){return _}};return _.locale(i,null,!0),i}(n(29))}}]);